"""Run with python -m capture.main; --once ORDER KIND [--file IMAGE]."""
import argparse
import asyncio
import logging
import os
import re
from pathlib import Path
from uuid import uuid4

import httpx
from dotenv import load_dotenv

from .camera import Camera, image_jpeg, parse_roi
from .sse import events
from .uploader import upload

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"packing", "ready", "handed_off"}
log = logging.getLogger(__name__)


async def run(args):
    load_dotenv(ROOT / "capture" / ".env")
    backend = os.getenv("BACKEND_URL", "http://localhost:8000")
    key = os.getenv("CAPTURE_KEY", "")
    if not key:
        raise ValueError("Set CAPTURE_KEY in capture/.env (copy capture/.env.example)")
    roi = parse_roi(os.getenv("ROI", ""))
    video = os.getenv("VIDEO_FILE") or None
    if args.file and not args.once:
        raise ValueError("--file requires --once ORDER KIND")
    if args.once and args.once[1] not in KINDS:
        raise ValueError("Kind must be packing, ready, or handed_off")
    camera = None if args.file else Camera(int(os.getenv("CAMERA_INDEX", "0")), video, roi)
    source = "upload" if args.file else "video" if video else "webcam"
    seen = set()
    queue = asyncio.Queue(maxsize=100)

    async with httpx.AsyncClient(timeout=15) as client:
        async def capture_one(order_id, kind):
            if kind == "packing" and not args.file:
                await asyncio.sleep(0.8)
            jpeg = await asyncio.to_thread(image_jpeg, args.file, roi) if args.file else await asyncio.to_thread(camera.snapshot)
            # Save only event-triggered stills, under the gitignored frames directory.
            folder = ROOT / "capture" / "frames"
            folder.mkdir(exist_ok=True)
            safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", order_id)[:80]
            await asyncio.to_thread((folder / f"{safe_id}_{kind}_{uuid4().hex[:8]}.jpg").write_bytes, jpeg)
            result = await upload(client, backend, key, order_id, kind, source, jpeg)
            log.info("Uploaded %s %s (%s)", order_id, kind, result.get("id", "evidence"))

        async def worker():
            while True:
                order_id, kind = await queue.get()
                try:
                    await capture_one(order_id, kind)
                except Exception:
                    # Don't retry an ambiguous POST: the server may already have saved it.
                    log.error("Capture/upload failed for %s %s; use --once to retry", order_id, kind)
                finally:
                    queue.task_done()

        workers = []
        try:
            if args.once:
                await capture_one(*args.once)
                return
            workers = [asyncio.create_task(worker()) for _ in range(2)]
            log.info("Listening for order status changes at %s", backend)
            async for event, order in events(backend):
                if event != "order.updated" or not isinstance(order, dict):
                    continue
                order_id, kind = order.get("id"), order.get("status")
                if not isinstance(order_id, str) or not isinstance(kind, str) or kind not in KINDS:
                    continue
                # Include the status timestamp so a re-seeded demo order is captured again.
                stamp = order.get(f"{kind}_at")
                if (order_id, kind, stamp) not in seen:
                    seen.add((order_id, kind, stamp))
                    await queue.put((order_id, kind))
        finally:
            for task in workers:
                task.cancel()
            await asyncio.gather(*workers, return_exceptions=True)
            if camera:
                await asyncio.to_thread(camera.close)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", nargs=2, metavar=("ORDER", "KIND"))
    parser.add_argument("--file", help="Use a photo instead of opening the camera")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        pass
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        # HTTP exception strings can include headers; don't print request details.
        log.error("%s", str(exc) if not isinstance(exc, httpx.HTTPError) else "Backend request failed; check URL, key, and order ID")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
