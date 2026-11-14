import asyncio
from datetime import datetime, timezone
from .. import db
from .dispatcher import create_alert
from ..config import STALE_THRESHOLD_S
threshold_s=STALE_THRESHOLD_S

async def watch():
    while True:
        try:
            now=datetime.now(timezone.utc)
            for o in db.all("orders"):
                if o.get("status")!="ready" or not o.get("ready_at"): continue
                ready=datetime.fromisoformat(o["ready_at"].replace("Z","+00:00"))
                elapsed=int((now-ready).total_seconds())
                if elapsed>threshold_s and not any(a.get("type")=="stale_handoff" and a.get("order_id")==o["id"] for a in db.all("alerts")):
                    await create_alert("stale_handoff","high",o["id"],f"Bag #{o['ticket_no']} ({o['channel'].replace('_',' ').title()}) ready {elapsed//60}:{elapsed%60:02d} and not handed off.")
        except Exception: pass
        await asyncio.sleep(5)
