import hashlib, hmac
from fastapi import HTTPException, Request
from .config import WEBHOOK_SECRET, CAPTURE_KEY, MANAGER_PIN

async def verify_hmac(request: Request):
    body=await request.body(); expected=hmac.new(WEBHOOK_SECRET.encode(),body,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(request.headers.get("X-Signature", ""), expected): raise HTTPException(401,detail={"error":{"code":"unauthorized","message":"Invalid signature"}})
    return body
def capture_auth(value):
    if not hmac.compare_digest(value or "", CAPTURE_KEY): raise HTTPException(401,detail={"error":{"code":"unauthorized","message":"Invalid capture key"}})
def manager_auth(value):
    if not hmac.compare_digest(value or "", MANAGER_PIN): raise HTTPException(401,detail={"error":{"code":"unauthorized","message":"Invalid manager PIN"}})
