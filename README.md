# Fault-finding, re-imagined: a diagnostic game scored on how you diagnose, not only what you pick

## ▶ [Open the live prototype](https://karimhbadrshl.github.io/work-sample-prototype/)

**No installation needed.** The link opens a working prototype in your browser. It loads in a couple of seconds and nothing you do is sent anywhere.

**What to do when it opens**

1. **Take the guided practice (about two minutes).** A walkthrough on a practice fault shows you each tool, one step at a time, with Previous and Next. It is not scored, and you can skip it.
2. **Do the two real items.** Pump 3 will not fill its tank. Click the pump switch with the *Hand* tool, use the *Voltmeter* (cost 1) or a *Spare part* (cost 3), then pick the failed part in *Your diagnosis* and press *Submit diagnosis* twice. Fix the right part and the tank fills. The second item is harder if your first diagnosis was sound, easier if not.
3. **Ask the AI mentor** (right panel) what a healthy part reads, or try *"Which part is faulty?"*. It will not say. The *Reference guide* tab has the same specs.

The demo runs the AI mentor in **mock mode**: a transparent rules assistant that is never given the fault, so it cannot leak it. It needs no API key. A live language-model mentor would sit behind a server, with the same guardrails and test prompts.

---

## For technical reviewers

| | |
|---|---|
| [game/engine.js](game/engine.js) | The whole model: pump line, item bank and routing, tests, scoring, mentor mock, integrity flags. No dependencies. |
| [game/ui.js](game/ui.js), [game/style.css](game/style.css) | The scene, tools, practice and screens (plain JavaScript and SVG) |
| [game/eval.js](game/eval.js), [game/results.md](game/results.md) | Evaluation on simulated candidates, run with `node game/eval.js` |
| [game/APPROACH.md](game/APPROACH.md) | Design, scoring, routing and anti-cheating in one page |
| [DECISIONS.md](DECISIONS.md) | Decisions log: what I chose, what I rejected, and the trade-off |
| [tools/](tools/) | Build of the single-page demo (`build_game.py`), browser check, publishing |

All data are synthetic. The evaluation uses simulated candidates, so it shows the scoring behaves as designed, not that it is valid.
