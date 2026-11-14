"""Validate demo images; with a key, record A2 outputs for all six fixtures."""
import argparse
import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

from backend.agents.llm.describer import describe_evidence, _image_jpeg

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("fries_in_bag", "no_fries_in_bag", "sealed_bag", "blocked", "empty_counter", "drink_only")
ORDER = {"items": [{"name": "Cheeseburger", "qty": 1},
                   {"name": "Fries", "qty": 1}, {"name": "Coke", "qty": 1}]}


def target_met(name, result):
    items = result["visible_items"]
    fries = any(item["name"].casefold() == "fries" for item in items)
    if name == "fries_in_bag":
        return fries and result["confidence"] >= 0.6
    if name == "no_fries_in_bag":
        return not fries
    if name == "sealed_bag":
        return result["visibility"] != "clear" and result["confidence"] <= 0.5
    if name == "blocked":
        return result["visibility"] == "blocked" and result["confidence"] <= 0.5
    if name == "empty_counter":
        return not items
    return (not fries and sum(item["qty"] for item in items) == 2
            and all(any(term in item["name"].casefold()
                        for term in ("drink", "cup", "coke", "soda", "beverage")) for item in items))


async def run(args):
    load_dotenv(ROOT / "backend" / ".env")
    photos = ROOT / "demo" / "photos"
    manifest = json.loads((photos / "manifest.json").read_text())
    for name in NAMES:
        path = photos / f"{name}.jpg"
        with Image.open(path) as image:
            image.verify()
        assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest["sha256"][path.name], path.name
        # Exercise the exact image preprocessing used by A2 without making an API call.
        import io
        with Image.open(io.BytesIO(_image_jpeg(str(path)))) as image:
            assert max(image.size) <= 768
        print(f"PASS JPEG / SHA-256 / A2 preprocessing: {path.name}")
    if args.check:
        return 0
    if not os.getenv("OPENAI_API_KEY"):
        print("Calibration not run: set OPENAI_API_KEY in backend/.env. No stub results were recorded.")
        return 2
    report = {"created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
              "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
              "image_provenance": manifest["provenance"], "results": {}}
    for name in NAMES:
        result = await describe_evidence(str(photos / f"{name}.jpg"), ORDER)
        analyzed = not result.get("stub") and result.get("notes") != "Could not analyze"
        passed = analyzed and target_met(name, result)
        report["results"][name] = {"description": result, "analyzed": analyzed, "target_met": passed}
        print(f"{name}: {'PASS' if passed else 'REVIEW'}")
    (photos / "calibration.json").write_text(json.dumps(report, indent=2) + "\n")
    print("Saved demo/photos/calibration.json; inspect outputs before updating seed descriptions.")
    return 0 if all(row["target_met"] for row in report["results"].values()) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate files and resizing without an API key or model calls")
    try:
        raise SystemExit(asyncio.run(run(parser.parse_args())))
    except (OSError, ValueError, AssertionError) as exc:
        print(f"Fixture validation failed: {exc}")
        raise SystemExit(1)
