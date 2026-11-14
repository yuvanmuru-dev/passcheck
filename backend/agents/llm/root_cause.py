"""A5 Root-Cause agent (owner: lead).

Contract: contracts/api.md §5
    async def run_root_cause(window_start: str, window_end: str, bundle: dict) -> dict
        bundle = {"orders": [Order], "charges": [ErrorCharge], "decisions": [DisputeDecision],
                  "alerts": [Alert], "evidence": [Evidence]}   (all within the window)
        returns Insight fields except id / created_at

STUB: returns the contract example with "stub": True. The real agent replaces the body
of run_root_cause without changing the signature or return shape.

Standalone:
    python -m backend.agents.llm.root_cause [path/to/bundle.json]
"""
from __future__ import annotations

import asyncio
import copy
import json
import sys

_STUB_INSIGHT: dict = {
    "window_start": "2026-11-10T00:00:00Z",
    "window_end": "2026-11-14T23:59:59Z",
    "cause": "Fries missing on lunch delivery orders from Station 2",
    "confidence": 0.78,
    "reasoning": (
        "4 of 7 error charges are fries; all Station 2; all 12:00-13:00 local; "
        "Station 2 order volume 2.3x its daily average in that hour."
    ),
    "evidence": {"charge_ids": [], "order_ids": ["ord_131", "ord_139"], "alert_ids": []},
    "recommendations": [
        {"priority": 1, "action": "Add a fries checkpoint at the pass for delivery bags 12-1 PM",
         "est_impact": "~$16/week in charges"},
        {"priority": 2, "action": "Move one prep cook to Station 2 during lunch peak",
         "est_impact": "fewer misses, faster tickets"},
        {"priority": 3, "action": "Point the counter camera at the bagging area for Station 2 bags",
         "est_impact": "more disputes winnable"},
    ],
    "stub": True,
}


async def run_root_cause(window_start: str, window_end: str, bundle: dict) -> dict:
    """Return Insight fields (except id/created_at) for the given window."""
    insight = copy.deepcopy(_STUB_INSIGHT)
    insight["window_start"] = window_start
    insight["window_end"] = window_end
    # Only cite IDs that actually exist in the bundle (same rule the real agent enforces).
    known_orders = {o.get("id") for o in bundle.get("orders", [])}
    insight["evidence"]["order_ids"] = [i for i in insight["evidence"]["order_ids"] if i in known_orders]
    return insight


if __name__ == "__main__":
    data: dict = {}
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            data = json.load(f)
    result = asyncio.run(run_root_cause(
        data.get("window_start", "2026-11-10T00:00:00Z"),
        data.get("window_end", "2026-11-14T23:59:59Z"),
        data.get("bundle", data),
    ))
    print(json.dumps(result, indent=2))
