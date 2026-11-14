"""A2 evidence description; callable without an OpenAI key."""


async def describe_evidence(image_path: str, order: dict) -> dict:
    """Return an Evidence.description dict: visible_items, visibility, notes, confidence."""
    return {
        "visible_items": [
            {"name": "Cheeseburger", "qty": 2},
            {"name": "Fries", "qty": 1},
            {"name": "Coke", "qty": 1},
        ],
        "visibility": "clear",
        "notes": "STUB: Open bag, two wrapped burgers, red fries sleeve, cup with lid.",
        "confidence": 0.84,
        "stub": True,
    }
