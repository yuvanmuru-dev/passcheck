# Capture & vision (P2)

From the repository root:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r capture/requirements.txt
cp capture/.env.example capture/.env
python -m capture.main
```

Set `CAPTURE_KEY` to the backend's key. Set `ROI=x,y,width,height` to crop to the
bagging area, or `VIDEO_FILE=/path/to/demo.mp4` to loop a video instead of opening
`CAMERA_INDEX=0`. Relative video paths resolve from the repository root. Grant
camera access to the terminal when prompted. The background reader keeps only
the latest frame in memory; it never records or saves video. Stills are saved
only on status events or explicit manual capture, under ignored `capture/frames/`.

`order.updated` events with status `packing`, `ready`, or `handed_off` trigger a
JPEG upload with the matching `kind`. Packing waits 0.8 seconds. Images are
cropped and downscaled to at most 768 pixels on the long side. Duplicate
`(order, kind)` events are suppressed for this process's lifetime, including
failed/ambiguous uploads (to avoid duplicating a server-accepted upload). The
service reconnects after SSE failures, with backoff up to 30 seconds. Events
missed during a disconnect are not recovered: the contract has no replay IDs.
Use manual mode after an upload failure or missed event. Restarting clears
duplicate suppression; restarting and reseeding the demo together is safest.

## Manual demo backup

With the backend running and the order present:

```sh
python -m capture.main --once ord_219 packing --file demo/photos/fries_in_bag.jpg
python -m capture.main --once ord_219 ready
```

The first command needs no camera and sends `source=upload`; live/video capture
sends `webcam`/`video`. `GET /api/orders/ord_219` should include the new evidence.
The backend invokes the describer separately; capture itself makes no LLM calls.

## A2 integration

P1 imports `async describe_evidence(image_path: str, order: dict) -> dict` from
`backend.agents.llm.describer`. Install `capture/requirements.txt` in the shared
virtualenv (includes OpenAI/Pydantic/Pillow for A2 and HTTPX SOCKS proxy support).
The describer itself uses Pillow, already in backend requirements, and can run
without installing or importing OpenCV or the capture service. The backend must load its own
`backend/.env` before invoking A2. The standalone calibration CLI loads that file.
`OPENAI_MODEL` defaults to `gpt-4o`. No API key returns the contract's fixed example
with `stub: true` and a `STUB:` note; this is mock output, never photo calibration.
With a key, output is schema-validated, retried once, then fails safely with no
visible items, blocked visibility and zero confidence. Non-clear confidence is
capped at 0.5. Ticket name normalization uses only unambiguous simple synonyms.

```sh
python -m backend.agents.llm.describer demo/photos/fries_in_bag.jpg
python -m capture.smoke
```

`capture.smoke` uses synthetic images, a local mock HTTP transport, and a fake
OpenAI client. It does not use the network, camera, or real API key.

## Integration verification (November 14, 2026)

Verified against P1's actual FastAPI backend in a temporary database/storage
directory, with a synthetic looping video and an explicitly empty OpenAI key:

| Check | Result |
| --- | --- |
| Packing bump → SSE → saved evidence and A2 stub | Passed, 0.864 seconds |
| Ready bump → saved evidence | Passed, 0.107 seconds |
| Handed off bump → saved evidence | Passed, 0.111 seconds |
| Uploaded frame hash matches image endpoint bytes | Passed for all three frames |
| Manual `--once --file` upload to actual backend | Passed, source is `upload` |
| Offline smoke check on shared Python 3.11 virtualenv | Passed |

These timings are local test results, not production latency guarantees. No real
webcam, food-photo calibration, or live OpenAI response has been verified yet.
Test data was isolated and removed after verification; the demo database was not
seeded or wiped.
