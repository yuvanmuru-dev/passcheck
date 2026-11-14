"""Deterministic demo seed → demo/seed/week.json  (owner: lead)

Shape: contracts/api.md §6. Story: PLAN.md §3 / handoff/LEAD-manager.md.

    python3 demo/seed/generate.py

Story in one paragraph:
  Nov 10–14, 120 orders (tickets 100–219), lunch 11:00–14:00 and dinner 17:00–20:00 CT.
  Station 2 gets slammed 12:00–13:00 every day. 7 delivery-app error charges:
  4 × missing Fries from Station 2 at lunch (#131, #139, #158, #184): two have packing
  frames showing fries going in (#139, #158 → DISPUTE), two show no fries (#131, #184 → ACCEPT).
  Plus: missing drink with no frames (#169 → NEEDS_REVIEW), wrong item at Station 1 at 11:40
  (#104 ~11:47, frame blocked, the red herring), cold food on an order that sat 6 min (#194).
  Live demo: #218 (Cheeseburger, Fries, Coke: matches the photo) and #219 (Nuggets: mismatch) are left "new".
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

RNG = random.Random(1114)
CT = timezone(timedelta(hours=-6))  # CST in November
OUT = Path(__file__).with_name("week.json")

MENU = {
    "Cheeseburger": 6.49,
    "Chicken Sandwich": 6.99,
    "Nuggets (6)": 5.49,
    "Fries": 3.99,
    "Coke": 2.49,
    "Sprite": 2.49,
    "Milkshake": 4.49,
}
MAINS = ["Cheeseburger", "Cheeseburger", "Chicken Sandwich", "Nuggets (6)"]
DRINKS = ["Coke", "Coke", "Sprite", "Milkshake"]
MODS = {"Cheeseburger": ["no onion", "extra pickles", "no cheese"], "Chicken Sandwich": ["spicy", "no mayo"]}
CHANNELS = ["doordash"] * 22 + ["ubereats"] * 18 + ["takeout"] * 15 + ["dine_in"] * 30 + ["drive_thru"] * 15
CAPTURED_CHANNELS = {"doordash", "ubereats", "takeout"}  # packed at the counter camera

PHOTO = "demo/photos/{}.jpg"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ct(day: int, hh: int, mm: int, ss: int = 0) -> datetime:
    return datetime(2026, 11, day, hh, mm, ss, tzinfo=CT)


def day_slots(day: int) -> list[datetime]:
    """24 order times per day: 5 (11–12), 12 (12–13, the rush), 3 (13–14), 4 dinner.
    Nov 14 has the lunch block, then 4 afternoon orders just before the demo."""
    slots = [ct(day, 11, 3 + i * 11, RNG.randint(0, 59)) for i in range(5)]
    slots += [ct(day, 12, 2 + i * 5, RNG.randint(0, 50)) for i in range(12)]
    slots += [ct(day, 13, 10 + i * 17, RNG.randint(0, 59)) for i in range(3)]
    if day < 14:
        slots += [ct(day, 17, 40, 0) + timedelta(minutes=40 * i + RNG.randint(0, 15)) for i in range(4)]
    else:
        slots += [ct(14, 14, 30 + 6 * i, 0) for i in range(4)]
    return slots


def make_items(force: list[str] | None = None) -> list[dict]:
    names = force or ([RNG.choice(MAINS)] + (["Fries"] if RNG.random() < 0.85 else []) + [RNG.choice(DRINKS)])
    items, seen = [], {}
    for n in names:
        seen[n] = seen.get(n, 0) + 1
    if not force and RNG.random() < 0.25:  # some orders for two
        seen[names[0]] += 1
    for n, q in seen.items():
        mods = [RNG.choice(MODS[n])] if n in MODS and RNG.random() < 0.3 else []
        items.append({"name": n, "qty": q, "price": MENU[n], "modifiers": mods})
    return items


# ---- special tickets (the story) ------------------------------------------------------------
SPECIAL = {
    104: dict(channel="ubereats", station=1,
              items=["Cheeseburger", "Fries", "Coke"], frame="blocked"),
    131: dict(channel="ubereats", station=2,
              items=["Cheeseburger", "Fries", "Coke"], frame="no_fries"),
    139: dict(channel="doordash", station=2,
              items=["Cheeseburger", "Cheeseburger", "Fries", "Coke"], frame="fries"),
    158: dict(channel="doordash", station=2,
              items=["Chicken Sandwich", "Fries", "Sprite"], frame="fries"),
    169: dict(channel="doordash", station=3,
              items=["Nuggets (6)", "Fries", "Coke"], frame=None),       # capture missed it
    184: dict(channel="ubereats", station=2,
              items=["Cheeseburger", "Fries", "Milkshake"], frame="no_fries"),
    219: dict(channel="doordash", station=1,
              items=["Nuggets (6)", "Fries", "Coke"], frame=None),        # live demo: photo shows a burger -> mismatch
    218: dict(channel="doordash", station=2,
              items=["Cheeseburger", "Fries", "Coke"], frame=None),       # live demo: matches the photo
    194: dict(channel="doordash", station=3,
              items=["Chicken Sandwich", "Fries", "Coke"], frame="fries", handoff_gap_s=372),
}

CHARGES = [
    dict(ticket=131, platform="ubereats", reason="missing_item", items=[("Fries", 1)], amount=3.99,
         note="No fries in my bag", after=timedelta(days=1, hours=2)),
    dict(ticket=139, platform="doordash", reason="missing_item", items=[("Fries", 1)], amount=3.99,
         note="Fries were missing", after=timedelta(days=2, hours=2, minutes=17)),
    dict(ticket=158, platform="doordash", reason="missing_item", items=[("Fries", 1)], amount=3.99,
         note="where are my fries", after=timedelta(days=1, hours=5)),
    dict(ticket=184, platform="ubereats", reason="missing_item", items=[("Fries", 1)], amount=3.99,
         note="Missing fries", after=timedelta(hours=20)),
    dict(ticket=169, platform="doordash", reason="missing_item", items=[("Coke", 1)], amount=2.49,
         note="No drink in the order", after=timedelta(hours=18)),
    dict(ticket=104, platform="ubereats", reason="wrong_item", items=[("Cheeseburger", 1)], amount=6.49,
         note="Got a chicken sandwich instead of a cheeseburger", after=timedelta(days=1)),
    dict(ticket=194, platform="doordash", reason="cold_food", items=[("Chicken Sandwich", 1), ("Fries", 1)],
         amount=5.49, note="Food was cold when it arrived", after=timedelta(hours=16)),
]


def description(kind: str, frame: str | None, items: list[dict]) -> dict:
    if kind == "handed_off":
        return {"visible_items": [], "visibility": "partial",
                "notes": "Bag folded and stapled on the counter; contents not visible.", "confidence": 0.2}
    if frame == "blocked":
        return {"visible_items": [], "visibility": "blocked",
                "notes": "An arm blocks most of the bag opening.", "confidence": 0.25}
    visible = [{"name": i["name"], "qty": i["qty"]} for i in items]
    if frame == "no_fries":
        visible = [v for v in visible if v["name"] != "Fries"]
        notes = "Open bag; wrapped sandwich and drink visible; no fries sleeve seen."
        conf = 0.82
    elif any(i["name"] == "Fries" for i in items):
        notes = "Open bag; items visible going in, including a red fries sleeve."
        conf = round(RNG.uniform(0.78, 0.9), 2)
    else:
        notes = "Open bag; wrapped items and drink visible going in."
        conf = round(RNG.uniform(0.78, 0.9), 2)
    return {"visible_items": visible, "visibility": "clear", "notes": notes, "confidence": conf}


def main() -> None:
    times: list[datetime] = []
    for d in range(10, 15):
        times += day_slots(d)
    assert len(times) == 120, len(times)

    orders, evidence, charges = [], [], []
    for idx, t in enumerate(times):
        ticket = 100 + idx
        sp = SPECIAL.get(ticket, {})
        created = t
        in_rush = created.hour == 12
        channel = sp.get("channel") or RNG.choice(CHANNELS)
        station = sp.get("station") or (2 if in_rush and RNG.random() < 0.6 else RNG.choice([1, 2, 3]))
        items = make_items(sp.get("items"))

        packing = created + timedelta(seconds=RNG.randint(240, 420) + (150 if in_rush and station == 2 else 0))
        ready = packing + timedelta(seconds=RNG.randint(30, 90))
        handed = ready + timedelta(seconds=sp.get("handoff_gap_s", RNG.randint(30, 170)))

        status, packing_at, ready_at, handed_at = "handed_off", packing, ready, handed
        if ticket == 218:
            status, packing_at, ready_at, handed_at = "new", None, None, None
        if ticket == 219:
            status, packing_at, ready_at, handed_at = "new", None, None, None

        orders.append({
            "external_id": f"toast_{RNG.getrandbits(24):06x}",
            "ticket_no": ticket,
            "channel": channel,
            "station": station,
            "items": items,
            "created_at": iso(created),
            "status": status,
            "packing_at": iso(packing_at) if packing_at else None,
            "ready_at": iso(ready_at) if ready_at else None,
            "handed_off_at": iso(handed_at) if handed_at else None,
        })

        captured = channel in CAPTURED_CHANNELS and status == "handed_off"
        frame = sp.get("frame", "fries") if ticket in SPECIAL else "fries"
        if captured and not (ticket in SPECIAL and sp.get("frame") is None):
            img = {"fries": "fries_in_bag", "no_fries": "no_fries_in_bag", "blocked": "blocked"}[frame]
            if frame == "fries" and not any(i["name"] == "Fries" for i in items):
                img = "drink_only" if all(i["name"] in DRINKS for i in items) else "fries_in_bag"
            evidence.append({"ticket_no": ticket, "kind": "packing", "captured_at": iso(packing_at + timedelta(seconds=1)),
                             "image": PHOTO.format(img), "description": description("packing", frame, items)})
            evidence.append({"ticket_no": ticket, "kind": "handed_off", "captured_at": iso(handed_at + timedelta(seconds=1)),
                             "image": PHOTO.format("sealed_bag"), "description": description("handed_off", None, items)})

    by_ticket = {o["ticket_no"]: o for o in orders}
    for c in CHARGES:
        o = by_ticket[c["ticket"]]
        charged = datetime.strptime(o["handed_off_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) + c["after"]
        charges.append({
            "platform": c["platform"], "ticket_no": c["ticket"], "reason": c["reason"],
            "items": [{"name": n, "qty": q} for n, q in c["items"]], "amount": c["amount"],
            "customer_note": c["note"], "charged_at": iso(charged),
        })

    OUT.write_text(json.dumps({"orders": orders, "evidence": evidence, "charges": charges}, indent=2) + "\n")
    print(f"wrote {OUT}: {len(orders)} orders, {len(evidence)} evidence, {len(charges)} charges")


if __name__ == "__main__":
    main()
