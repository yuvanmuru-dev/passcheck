"""SSE framing and reconnects; accepts heartbeat comments and multiline data."""
import asyncio
import json
import logging

import httpx

log = logging.getLogger(__name__)


async def parse_events(lines):
    event, data = "message", []
    async for line in lines:
        if not line:
            if data:
                try:
                    yield event, json.loads("\n".join(data))
                except json.JSONDecodeError:
                    log.warning("Skipping malformed SSE data")
            event, data = "message", []
        elif not line.startswith(":"):
            field, _, value = line.partition(":")
            value = value.removeprefix(" ")
            if field == "event":
                event = value
            elif field == "data":
                data.append(value)


async def events(backend_url: str):
    delay = 1
    timeout = httpx.Timeout(30, read=45)
    async with httpx.AsyncClient(timeout=timeout) as client:
        while True:
            try:
                async with client.stream("GET", f"{backend_url.rstrip('/')}/api/stream",
                                         headers={"Accept": "text/event-stream"}) as response:
                    response.raise_for_status()
                    async for event in parse_events(response.aiter_lines()):
                        delay = 1
                        yield event
            except (httpx.HTTPError, OSError):
                log.warning("SSE unavailable; reconnecting in %ss", delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)
