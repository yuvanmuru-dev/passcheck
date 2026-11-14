"""Contract multipart upload. Never log the capture key."""
from urllib.parse import quote

import httpx


async def upload(client: httpx.AsyncClient, backend_url: str, capture_key: str,
                 order_id: str, kind: str, source: str, jpeg: bytes) -> dict:
    if not capture_key:
        raise ValueError("CAPTURE_KEY is required in capture/.env")
    response = await client.post(
        f"{backend_url.rstrip('/')}/api/orders/{quote(order_id, safe='')}/evidence",
        headers={"X-Capture-Key": capture_key},
        data={"kind": kind, "source": source},
        files={"file": ("frame.jpg", jpeg, "image/jpeg")},
    )
    response.raise_for_status()
    return response.json()
