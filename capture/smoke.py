"""Small offline smoke check: python -m capture.smoke."""
import argparse
import asyncio
import base64
import json
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import cv2
import httpx
import numpy as np
from pydantic import ValidationError

from backend.agents.llm import describer
from .camera import Camera, encode_frame, image_jpeg, parse_roi
from .sse import parse_events
from .uploader import upload
from . import main as service


async def check():
    image = np.zeros((1000, 1600, 3), dtype=np.uint8)
    jpeg = encode_frame(image)
    decoded = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape[:2] == (480, 768)
    cropped = cv2.imdecode(np.frombuffer(encode_frame(image, (100, 100, 200, 300)), np.uint8), 1)
    assert cropped.shape[:2] == (300, 200)
    assert parse_roi("1,2,3,4") == (1, 2, 3, 4)
    for bad in ["1,2,3", "-1,0,3,4", "0,0,0,4"]:
        try:
            parse_roi(bad)
            raise AssertionError("Invalid ROI accepted")
        except ValueError:
            pass

    async def lines():
        for line in [": ping", "", "event: order.updated", 'data: {"id":"ord_219",',
                     'data: "status":"packing"}', "", "data: broken", "",
                     "event: alert.created", 'data: {"id":"alt_test"}', ""]:
            yield line
    parsed = [event async for event in parse_events(lines())]
    assert parsed == [("order.updated", {"id": "ord_219", "status": "packing"}),
                      ("alert.created", {"id": "alt_test"})]

    requests = []
    def handler(request):
        assert request.headers["X-Capture-Key"] == "smoke-key"
        assert request.url.path == "/api/orders/ord_219/evidence"
        assert b'filename="frame.jpg"' in request.content
        assert b"image/jpeg" in request.content
        assert b'name="source"\r\n\r\nupload' in request.content or b'name="source"\r\n\r\nwebcam' in request.content
        requests.append(request)
        return httpx.Response(201, json={"id": "ev_smoke"})
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        result = await upload(client, "http://test", "smoke-key", "ord_219", "packing", "upload", jpeg)
        assert result["id"] == "ev_smoke"
    requests.clear()

    with tempfile.TemporaryDirectory() as directory:
        photo = Path(directory) / "test.jpg"
        photo.write_bytes(jpeg)
        assert image_jpeg(str(photo))
        # Exercise actual OpenCV video reading and EOF looping without a webcam.
        video = Path(directory) / "loop.avi"
        writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), 10, (64, 48))
        assert writer.isOpened()
        for _ in range(2):
            writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
        writer.release()
        camera = Camera(video_file=str(video))
        try:
            assert camera.snapshot()
            await asyncio.sleep(0.4)
            assert camera.snapshot()
        finally:
            camera.close()

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            assert (await describer.describe_evidence(str(photo), {}))["stub"] is True

        raw = {"visible_items": [{"name": "french fries", "qty": 1}, {"name": "cup", "qty": 1}],
               "visibility": "partial", "notes": "Part of tray obscured", "confidence": 0.95}
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(raw)))])
        fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(side_effect=[ValueError("bad output"), completion]))))
        context = AsyncMock()
        context.__aenter__.return_value = fake
        with patch.dict(os.environ, {"OPENAI_API_KEY": "smoke-only"}), patch("openai.AsyncOpenAI", return_value=context):
            result = await describer.describe_evidence(str(photo), {"items": [{"name": "Fries"}, {"name": "Coke"}]})
            assert result["confidence"] == 0.5
            assert result["visible_items"] == [{"name": "Fries", "qty": 1}, {"name": "Coke", "qty": 1}]
            assert fake.chat.completions.create.await_count == 2
            sent = fake.chat.completions.create.call_args.kwargs["messages"][1]["content"][1]["image_url"]["url"]
            sent_image = cv2.imdecode(np.frombuffer(base64.b64decode(sent.split(",")[1]), np.uint8), 1)
            assert max(sent_image.shape[:2]) <= 768
            fake.chat.completions.create = AsyncMock(side_effect=ValueError("invalid"))
            failed = await describer.describe_evidence(str(photo), {})
            assert failed == describer._fallback()
            assert fake.chat.completions.create.await_count == 2

        for update in [{"confidence": 1.1}, {"notes": "x" * 201}, {"visibility": "unknown"}]:
            try:
                describer.Description.model_validate(raw | update)
                raise AssertionError("Invalid model output accepted")
            except ValidationError:
                pass

        class FakeCamera:
            def __init__(self, *args):
                pass
            def snapshot(self):
                return jpeg
            def close(self):
                pass

        async def status_events(_):
            yield "order.created", {"id": "ord_219", "status": "new"}
            for kind in ["packing", "packing", "ready", "handed_off", "ready", "new"]:
                yield "order.updated", {"id": "ord_219", "status": kind}
            for _ in range(60):
                if len(requests) == 3:
                    return
                await asyncio.sleep(0.05)
            raise AssertionError("Status uploads did not finish")

        real_client = httpx.AsyncClient
        def mock_client(**kwargs):
            return real_client(transport=transport, **kwargs)

        with patch.dict(os.environ, {"CAPTURE_KEY": "smoke-key", "BACKEND_URL": "http://test", "ROI": "", "VIDEO_FILE": ""}), \
             patch.object(service, "ROOT", Path(directory)), \
             patch.object(service, "Camera", FakeCamera), \
             patch.object(service, "events", status_events), \
             patch.object(service.httpx, "AsyncClient", mock_client):
            (Path(directory) / "capture").mkdir()
            await service.run(argparse.Namespace(once=None, file=None))
            assert len(requests) == 3
            assert len(list((Path(directory) / "capture" / "frames").glob("*.jpg"))) == 3
            requests.clear()
            await service.run(argparse.Namespace(once=["ord_219", "packing"], file=str(photo)))
            assert len(requests) == 1

    print("PASS: resize/ROI, looping video, SSE parsing, multipart auth, event debounce,")
    print("      manual upload, no-key stub, schema/retry/fallback, synonyms/confidence cap")


if __name__ == "__main__":
    asyncio.run(check())
