import httpx
from ..config import NOTIFY_URL, NOTIFY_KEY
from .. import db, events

async def create_alert(kind, severity, order_id, message):
    import secrets
    from datetime import datetime, timezone
    alert={"id":"alt_"+secrets.token_hex(4),"type":kind,"severity":severity,"order_id":order_id,"message":message,"created_at":datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),"acked_at":None}
    db.put("alerts",alert["id"],alert); await events.publish("alert.created",alert)
    try:
        async with httpx.AsyncClient(timeout=3) as client: await client.post(NOTIFY_URL,headers={"X-Notify-Key":NOTIFY_KEY},json={"text":message,"severity":severity})
    except Exception: pass
    return alert
