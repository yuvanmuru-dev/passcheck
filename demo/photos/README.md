# P2 demo images and calibration handoff

All six required JPEGs are now supplied. These are **AI-generated synthetic demo
fixtures**, not restaurant camera recordings or evidence for real orders. The
files were copied unchanged from the user's `PassCheck_Images` folder. Provenance
and SHA-256 hashes are recorded in `manifest.json`.

Each image is 1672 × 941 pixels. All six pass JPEG decoding, hash verification,
and the actual A2 preprocessing path (JPEG output with a longest side <= 768 px).

## Visual expectations (human annotations, not model outputs)

| Filename | Visible scene | Calibration target |
| --- | --- | --- |
| `fries_in_bag.jpg` | Open bag; one foil-wrapped item, visible fries in a red sleeve, one lidded cup | Fries present, confidence >= 0.6 |
| `no_fries_in_bag.jpg` | Open bag; one foil-wrapped item and one lidded cup; no visible fries | No Fries listed |
| `sealed_bag.jpg` | Closed paper bag with stapled ticket; contents hidden | Non-clear visibility, confidence <= 0.5 |
| `blocked.jpg` | Black sleeve and forearm obscure the bag opening | Blocked visibility, confidence <= 0.5 |
| `empty_counter.jpg` | Empty counter in the foreground | No visible items |
| `drink_only.jpg` | Drink carrier with two cups | Two drinks, no fries or burgers |

A wrapper does not establish burger contents, and a generic cup does not establish
its drink brand. The A2 ticket-name synonym mapping is contextual normalization,
not visual proof of a brand. Do not lower these caveats to force a passing result.

## Reproduce checks and calibration

From the repository root, with the shared virtualenv activated:

```sh
python -m capture.calibrate --check
python -m capture.calibrate
```

The first command runs offline. The second loads the ignored `backend/.env`,
requires `OPENAI_API_KEY`, and writes actual model outputs and target checks to
`demo/photos/calibration.json`. It exits with code 2 without a key and does not
save stub outputs as calibration. A failed model call or missed target is marked
for review and exits with code 1. Use `OPENAI_MODEL` to select the backend model
(default `gpt-4o`). Each photo is analyzed once (with the describer's one retry).

**Current model calibration: pending API key.** No per-image model outputs or
confidence scores have been measured yet. The no-key describer returns a fixed
contract example with `stub: true`; it must not be used as photo-specific output.
The lead owns `demo/seed/week.json` and should update its pre-filled descriptions
only after reviewing measured results. Synthetic provenance should remain clear
in the demonstration.

The capture pipeline separately passed a real-backend integration test with a
synthetic looping video and the marked A2 stub; see `capture/README.md`. Real
webcam testing and calibration on physical food photographs remain pending.
