# P2 photo calibration handoff

Real photos have not been supplied yet. Do not substitute generated images for
camera evidence. Photograph the same bagging area in these six conditions:

| Filename | Required shot | Calibration target | Actual output |
| --- | --- | --- | --- |
| `fries_in_bag.jpg` | Open bag with burger, visible fries, drink | Fries present, confidence >= 0.6 | Pending real photo/key |
| `no_fries_in_bag.jpg` | Same scene, fries absent | No Fries listed | Pending real photo/key |
| `sealed_bag.jpg` | Closed bag on counter | Partial visibility, confidence <= 0.5 | Pending real photo/key |
| `blocked.jpg` | Hand/arm obscures bagging area | Blocked visibility, confidence <= 0.5 | Pending real photo/key |
| `empty_counter.jpg` | Empty bagging area | No visible items | Pending real photo/key |
| `drink_only.jpg` | Drink carrier only | Drink, no fries/burger | Pending real photo/key |

Place real JPEGs in this folder. With dependencies installed and an OpenAI key
in the ignored `backend/.env`, run each from the repository root:

```sh
python -m backend.agents.llm.describer demo/photos/fries_in_bag.jpg
```

Record the actual JSON outputs below once the six photos exist and the calls
succeed; the lead can then update seed descriptions. A result with `stub: true`
is a fixed contract example and is **not** a measured result for that photograph.
No real calibration or end-to-end camera/backend test has been claimed yet.
