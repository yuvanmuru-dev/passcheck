from __future__ import annotations
import asyncio, hashlib, io, json, secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, Request, Header, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from PIL import Image, UnidentifiedImageError
from . import db, events
from .config import *
from .security import verify_hmac, capture_auth, manager_auth
from .agents.dispatcher import create_alert
from .agents.llm.dispute import analyze_charge
from .schemas import POSPayload, ChargePayload
from pydantic import ValidationError

def validate_payload(model, value):
    try:
        parsed=model.model_validate(value)
        for name in ('created_at','charged_at'):
            dt=getattr(parsed,name,None)
            if dt is not None:
                if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
                setattr(parsed,name,dt.astimezone(timezone.utc))
        return parsed.model_dump(mode='json')
    except ValidationError:
        err('invalid_payload','Request fields do not match the API contract',422)

app=FastAPI(title="PassCheck API")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:3000"],allow_methods=["*"],allow_headers=["Content-Type","X-Manager-Pin","X-Signature","X-Capture-Key"])
ORDER_STATES=["new","packing","ready","handed_off"]
@app.exception_handler(HTTPException)
async def contract_error(request, exc):
    detail=exc.detail if isinstance(exc.detail,dict) and "error" in exc.detail else {"error":{"code":"request_error","message":str(exc.detail)}}
    return Response(content=json.dumps(detail),status_code=exc.status_code,media_type="application/json")
def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
def uid(prefix): return prefix+secrets.token_hex(4)
def err(code,message,status=404): raise HTTPException(status_code=status,detail={"error":{"code":code,"message":message}})
def must(table,key):
    val=db.get(table,key)
    if not val: err("not_found",f"{table[:-1].title()} not found")
    return val
def order_shape(o):
    o=dict(o); o["evidence_count"]=sum(e.get("order_id")==o["id"] for e in db.all("evidence")); return o
def log_audit(action, actor, input_data, output):
    row={"id":uid("aud_"),"actor":actor,"action":action,"input_sha256":hashlib.sha256(json.dumps(input_data,sort_keys=True).encode()).hexdigest(),"output":output,"created_at":now()}; db.put("audit_log",row["id"],row)

@app.on_event("startup")
async def startup():
    from .agents.watcher import watch
    app.state.watcher=asyncio.create_task(watch())
    cutoff=datetime.now(timezone.utc)-timedelta(days=FRAME_RETENTION_DAYS)
    for e in db.all("evidence"):
        if e.get("source")!="seed":
            try:
                if datetime.fromisoformat(e["captured_at"].replace("Z","+00:00"))<cutoff:
                    (BACKEND/"storage"/(e["id"]+".jpg")).unlink(missing_ok=True); db.db.execute("DELETE FROM evidence WHERE id=?",(e["id"],))
            except (ValueError,KeyError): pass
    db.db.commit()
@app.on_event("shutdown")
async def shutdown():
    task=getattr(app.state,"watcher",None)
    if task: task.cancel()
@app.get("/api/health")
async def health(): return {"ok":True}

@app.post("/api/pos/orders")
async def create_order(request:Request):
    body=await verify_hmac(request)
    try: x=json.loads(body)
    except Exception: err("invalid_json","Invalid JSON",400)
    x=validate_payload(POSPayload,x)
    for o in db.all("orders"):
        if o.get("external_id")==x.get("external_id"): return order_shape(o)
    if not x.get("external_id") or not x.get("ticket_no"): err("invalid_order","external_id and ticket_no required",422)
    items=x.get("items",[])
    if any(len(str(i.get("name","")))>80 or len(i.get("modifiers",[]))>10 for i in items): err("invalid_order","Item text limit exceeded",422)
    oid=f"ord_{x['ticket_no']}"
    if db.get("orders",oid): err("duplicate_ticket","Ticket number already exists",409)
    o={"id":oid,"ticket_no":int(x["ticket_no"]),"external_id":x["external_id"],"channel":x.get("channel","takeout"),"station":int(x.get("station",1)),"items":items,"total":round(sum(float(i.get("price",0))*int(i.get("qty",1)) for i in items),2),"status":"new","created_at":x.get("created_at",now()),"packing_at":None,"ready_at":None,"handed_off_at":None,"evidence_count":0}
    db.put("orders",oid,o); await events.publish("order.created",o); return Response(content=json.dumps(o),status_code=201,media_type="application/json")
@app.get("/api/orders")
async def list_orders(status:Optional[str]=None,limit:int=50):
    rows=[order_shape(o) for o in db.all("orders") if not status or o.get("status")==status]
    return {"orders":sorted(rows,key=lambda x:x.get("created_at",""),reverse=True)[:max(1,min(limit,200))]}
@app.get("/api/orders/{order_id}")
async def get_order(order_id:str):
    o=order_shape(must("orders",order_id)); ev=[e for e in db.all("evidence") if e["order_id"]==order_id]; ch=[c for c in db.all("charges") if c["order_id"]==order_id]; dec=[d for d in db.all("decisions") if d["charge_id"] in {c["id"] for c in ch}]
    return {"order":o,"evidence":ev,"charges":ch,"decisions":dec}
@app.post("/api/orders/{order_id}/status")
async def set_status(order_id:str, request:Request):
    o=must("orders",order_id); body=await request.json(); status=body.get("status")
    try: valid=ORDER_STATES.index(status)==ORDER_STATES.index(o["status"])+1
    except (ValueError,TypeError): valid=False
    if not valid: err("invalid_transition","Order status must move forward one step",409)
    o["status"]=status; o[status+"_at"]=now(); db.put("orders",order_id,o); o=order_shape(o); await events.publish("order.updated",o); return o

async def describe_task(path, order, evidence):
    if evidence.get("kind") != "packing": return
    try:
        from .agents.llm.describer import describe_evidence
        evidence["description"]=await describe_evidence(str(path),order); db.put("evidence",evidence["id"],evidence); await events.publish("evidence.described",evidence)
    except Exception: pass
@app.post("/api/orders/{order_id}/evidence",status_code=201)
async def upload_evidence(order_id:str, background:BackgroundTasks, file:UploadFile=File(...),kind:str=Form(...),source:str=Form("webcam"),x_capture_key:str=Header(None,alias="X-Capture-Key")):
    capture_auth(x_capture_key); order=must("orders",order_id)
    if kind not in ("packing","ready","handed_off") or source not in ("webcam","video","upload","seed"): err("invalid_evidence","Invalid kind or source",422)
    raw=await file.read(5*1024*1024+1)
    if len(raw)>5*1024*1024: err("file_too_large","Image exceeds 5 MB",413)
    if file.content_type not in ("image/jpeg","image/png"): err("invalid_image","Only JPEG and PNG are accepted",415)
    try:
        im=Image.open(io.BytesIO(raw)); im.verify(); im=Image.open(io.BytesIO(raw)); im.thumbnail((768,768)); out=io.BytesIO(); im.convert("RGB").save(out,"JPEG",quality=88,optimize=True); stored=out.getvalue()
    except (UnidentifiedImageError,OSError,ValueError): err("invalid_image","Image could not be decoded",415)
    eid=uid("ev_"); path=BACKEND/"storage"/(eid+".jpg"); path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(stored)
    e={"id":eid,"order_id":order_id,"kind":kind,"image_url":f"/api/evidence/{eid}/image","captured_at":now(),"sha256":hashlib.sha256(stored).hexdigest(),"source":source,"description":None}
    db.put("evidence",eid,e); await events.publish("evidence.created",e); background.add_task(describe_task,path,order,e); return e
@app.get("/api/evidence/{evidence_id}/image")
async def get_image(evidence_id:str):
    must("evidence",evidence_id); path=BACKEND/"storage"/(evidence_id+".jpg")
    if not path.exists(): err("not_found","Image not found")
    return Response(path.read_bytes(),media_type="image/jpeg")

async def add_charge(x):
    x=validate_payload(ChargePayload,x)
    order=next((o for o in db.all("orders") if o.get("ticket_no")==int(x.get("ticket_no",-1))),None)
    if not order: err("not_found","Order for ticket number not found")
    if len(str(x.get("customer_note","")))>500: err("invalid_charge","Customer note too long",422)
    charged=x.get("charged_at",now()); days=14 if x.get("platform")=="doordash" else 30
    deadline=(datetime.fromisoformat(charged.replace("Z","+00:00"))+timedelta(days=days)).isoformat(timespec="seconds").replace("+00:00","Z")
    c={"id":uid("chg_"),"order_id":order["id"],"platform":x.get("platform"),"reason":x.get("reason","other"),"items":x.get("items",[]),"amount":round(float(x.get("amount",0)),2),"customer_note":x.get("customer_note",""),"charged_at":charged,"dispute_deadline":deadline,"status":"new"}
    db.put("charges",c["id"],c); await events.publish("charge.created",c); await create_alert("charge_received","med",order["id"],f"{c['platform'].title()} charge received for order #{order['ticket_no']}: ${c['amount']:.2f}."); return c
@app.post("/api/charges",status_code=201)
async def create_charge(request:Request):
    body=await verify_hmac(request)
    try: x=json.loads(body)
    except Exception: err("invalid_json","Invalid JSON",400)
    return await add_charge(x)
@app.get("/api/charges")
async def list_charges(status:Optional[str]=None,x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); rows=[]
    for c in db.all("charges"):
        if status and c.get("status")!=status: continue
        o=db.get("orders",c["order_id"]); ds=[d for d in db.all("decisions") if d["charge_id"]==c["id"]]
        rows.append({**c,"order":order_shape(o) if o else None,"decision":max(ds,key=lambda d:d["created_at"]) if ds else None})
    return {"charges":sorted(rows,key=lambda c:c["charged_at"],reverse=True)}
@app.post("/api/charges/{charge_id}/analyze")
async def analyze(charge_id:str,x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); c=must("charges",charge_id); o=must("orders",c["order_id"]); ev=[e for e in db.all("evidence") if e["order_id"]==o["id"]]
    result=await analyze_charge(c,o,ev); d={"id":uid("dec_"),"charge_id":charge_id,**result,"created_at":now(),"approved_action":None,"approved_at":None}
    db.put("decisions",d["id"],d); c["status"]="analyzed"; db.put("charges",charge_id,c); log_audit("analyze_charge","ai",{"charge":c,"order":o,"evidence":ev},d)
    await events.publish("decision.created",d); await create_alert("decision_ready","med",o["id"],f"Dispute analysis ready for order #{o['ticket_no']}: {d['recommendation']}."); return d
@app.post("/api/charges/{charge_id}/approve")
async def approve(charge_id:str,request:Request,x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); c=must("charges",charge_id); body=await request.json(); action=body.get("action")
    if action not in ("disputed","accepted"): err("invalid_action","Action must be disputed or accepted",422)
    ds=[d for d in db.all("decisions") if d["charge_id"]==charge_id]
    if not ds: err("not_found","Analyze charge before approving")
    d=max(ds,key=lambda x:x["created_at"]); d["approved_action"]=action; d["approved_at"]=now()
    if body.get("final_text") is not None: d["draft_text"]=str(body["final_text"])[:2000]
    db.put("decisions",d["id"],d); c["status"]=action; db.put("charges",charge_id,c); log_audit("approve_charge","manager",body,d); return d

@app.get("/api/alerts")
async def list_alerts(unacked:bool=False): return {"alerts":[a for a in sorted(db.all("alerts"),key=lambda a:a["created_at"],reverse=True) if not unacked or not a["acked_at"]]}
@app.post("/api/alerts/{alert_id}/ack")
async def ack_alert(alert_id:str):
    a=must("alerts",alert_id); a["acked_at"]=now(); return db.put("alerts",alert_id,a)
@app.post("/api/insights/run")
async def run_insight(request:Request,x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); x=await request.json(); start=x["window_start"]; end=x["window_end"]
    def inside(row,key): return start<=row.get(key," ")<=end
    orders=[o for o in db.all("orders") if inside(o,"created_at")]; ids={o["id"] for o in orders}; charges=[c for c in db.all("charges") if c["order_id"] in ids and inside(c,"charged_at")]; cids={c["id"] for c in charges}
    bundle={"orders":orders,"charges":charges,"decisions":[d for d in db.all("decisions") if d["charge_id"] in cids],"alerts":[a for a in db.all("alerts") if a.get("order_id") in ids],"evidence":[e for e in db.all("evidence") if e["order_id"] in ids]}
    from .agents.llm.root_cause import run_root_cause
    result=await run_root_cause(start,end,bundle); i={"id":uid("ins_"),**result,"created_at":now()}; db.put("insights",i["id"],i); log_audit("run_root_cause","ai",bundle,i); await events.publish("insight.created",i); await create_alert("insight_ready","low",None,"PassCheck insights are ready."); return i
@app.get("/api/insights")
async def list_insights(x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); return {"insights":sorted(db.all("insights"),key=lambda x:x["created_at"],reverse=True)}
@app.get("/api/stats")
async def stats(x_manager_pin:str=Header(None,alias="X-Manager-Pin")):
    manager_auth(x_manager_pin); charges=db.all("charges"); today=datetime.now(timezone.utc).date().isoformat(); stale=[a for a in db.all("alerts") if a["type"]=="stale_handoff" and a["created_at"].startswith(today)]; handoffs=[]
    for o in db.all("orders"):
        try:
            if o.get("handed_off_at") and o.get("ready_at"): handoffs.append((datetime.fromisoformat(o["handed_off_at"].replace("Z","+00:00"))-datetime.fromisoformat(o["ready_at"].replace("Z","+00:00"))).total_seconds())
        except ValueError: pass
    def total(cs): return round(sum(float(c["amount"]) for c in cs),2)
    insights=db.all("insights")
    return {"charges_total_usd":total(charges),"disputed_usd":total([c for c in charges if c["status"]=="disputed"]),"accepted_usd":total([c for c in charges if c["status"]=="accepted"]),"pending_usd":total([c for c in charges if c["status"] in ("new","analyzed")]),"avg_handoff_s":round(sum(handoffs)/len(handoffs)) if handoffs else 0,"stale_count_today":len(stale),"top_cause":insights[-1].get("cause","") if insights else ""}
@app.get("/api/stream")
async def stream():
    async def gen():
        q=asyncio.Queue(maxsize=100); events.clients.add(q)
        try:
            while True:
                try: yield await asyncio.wait_for(q.get(),timeout=15)
                except asyncio.TimeoutError: yield ": ping\n\n"
        finally: events.clients.discard(q)
    return StreamingResponse(gen(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","Connection":"keep-alive"})

def demo_only():
    if not DEMO_MODE: err("not_found","Demo endpoints disabled",404)
@app.post("/api/demo/config")
async def demo_config(request:Request):
    demo_only(); x=await request.json(); value=max(1,int(x.get("stale_threshold_s",STALE_THRESHOLD_S)))
    from .agents import watcher
    watcher.threshold_s=value
    return {"stale_threshold_s":value}
@app.post("/api/demo/simulate-charge",status_code=201)
async def simulate_charge(request:Request):
    demo_only(); return await add_charge(await request.json())
@app.post("/api/demo/seed")
async def seed():
    demo_only(); path=ROOT/"demo"/"seed"/"week.json"
    if not path.exists(): err("seed_missing","demo/seed/week.json is not available",503)
    data=json.loads(path.read_text(encoding="utf-8"))
    for t in ("orders","evidence","charges","decisions","alerts","insights"): db.delete_all(t)
    counts={"orders":0,"evidence":0,"charges":0}
    for x in data.get("orders",[]):
        oid=f"ord_{x['ticket_no']}"; items=x.get("items",[]); o={"id":oid,"ticket_no":int(x["ticket_no"]),"external_id":x.get("external_id",f"seed_{oid}"),"channel":x.get("channel","takeout"),"station":int(x.get("station",1)),"items":items,"total":round(sum(float(i.get("price",0))*int(i.get("qty",1)) for i in items),2),"status":x.get("status","new"),"created_at":x.get("created_at",now()),"packing_at":x.get("packing_at"),"ready_at":x.get("ready_at"),"handed_off_at":x.get("handed_off_at"),"evidence_count":0}; db.put("orders",oid,o); counts["orders"]+=1
    for x in data.get("evidence",[]):
        order=next((o for o in db.all("orders") if o["ticket_no"]==int(x["ticket_no"])),None)
        if not order: continue
        eid=uid("ev_"); src=ROOT/x.get("image",""); dest=BACKEND/"storage"/(eid+".jpg"); dest.parent.mkdir(parents=True,exist_ok=True)
        try:
            im=Image.open(src); im.thumbnail((768,768)); out=io.BytesIO(); im.convert("RGB").save(out,"JPEG",quality=88); raw=out.getvalue()
        except Exception: raw=b""
        if raw: dest.write_bytes(raw)
        e={"id":eid,"order_id":order["id"],"kind":x["kind"],"image_url":f"/api/evidence/{eid}/image","captured_at":x.get("captured_at",now()),"sha256":hashlib.sha256(raw).hexdigest(),"source":"seed","description":x.get("description")}; db.put("evidence",eid,e); counts["evidence"]+=1
    for x in data.get("charges",[]):
        try: await add_charge(dict(x)); counts["charges"]+=1
        except HTTPException: pass
    return counts
