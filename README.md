# Fault-finding, re-imagined: a diagnostic game scored on how you diagnose, not only what you pick

## ▶ [Open the live prototype](https://karimhbadrshl.github.io/work-sample-prototype/)

**No installation needed.** The link opens a working prototype in your browser. It loads in a couple of seconds and nothing you do is sent anywhere.

**What to do when it opens**

1. **Read the briefing and press Start.** You are a technician; a packaging cell has stopped.
2. **Play one fault.** With the *Hand* tool, switch the conveyor and pump on (click the switches). Pick the *Voltmeter* and click parts to read their output; each reading costs 1, a spare part costs 3. Choose *Your diagnosis* at the right, press *Submit diagnosis* twice, and read the result: score, the fault, your path and an integrity record.
3. **Ask the AI mentor** (right panel). It explains parts, meters and method and tells you what a healthy part reads. Try asking it *"Which part is faulty?"*: it will not say. The *Reference guide* tab has the same specs without the chat.
4. **Try another form.** *Load another form* gives a different fault with different part labels, so no two candidates share an answer key.

The demo runs the AI mentor in **mock mode**: a transparent rules assistant that is never given the fault, so it cannot leak it. It needs no API key. A live language-model mentor would sit behind a server, with the same guardrails and the same test prompts.

---

## For technical reviewers

| | |
|---|---|
| [game/engine.js](game/engine.js) | The whole model: supply tree, fault generator, tests, scoring, mentor mock, integrity flags. No dependencies. |
| [game/ui.js](game/ui.js), [game/style.css](game/style.css) | The scene, tools and screens (plain JavaScript and SVG) |
| [game/eval.js](game/eval.js), [game/results.md](game/results.md) | Evaluation on simulated candidates, run with `node game/eval.js` |
| [game/APPROACH.md](game/APPROACH.md) | Design, scoring and anti-cheating in one page |
| [DECISIONS.md](DECISIONS.md) | Decisions log: what I chose, what I rejected, and the trade-off |
| [tools/](tools/) | Build of the single-page demo (`build_game.py`), browser check, publishing |

All data are synthetic. There is no real candidate data, and the evaluation uses simulated candidates, so it shows the scoring behaves as designed, not that it is valid.
