# [EDIT: Claim-style title, e.g. "Scoring customer replies with evidence a recruiter can check"]

## ▶ [Open the live prototype](https://REPLACE-ME.github.io/)

**No installation needed.** The link opens the working prototype in your browser. The first load takes about 10 to 30 seconds. Everything runs inside your browser, and nothing you type is sent anywhere.

**What to do when it opens**

1. **Try the task.** [EDIT: one sentence on what to pick or type, and which button to press.]
2. **Try the tricky ones.** [EDIT: which examples show manipulation attempts, unusable responses or edge cases.]
3. **See the evidence.** The *Evidence* tab shows how well the scores agree with intended scores, plus robustness and fairness checks. The *Approach* tab summarises the design in one screen.

The demo runs in **mock mode**. A simple, transparent rules scorer stands in for the AI model, so it is free and needs no API key. The AI scorer is in the code and switches on with one setting.

---

## For technical reviewers

| | |
|---|---|
| [prototype/](prototype/) | The app, scorer, prompts and rubric (`config.py`), synthetic data, evaluation. See [prototype/README.md](prototype/README.md) to run it locally. |
| [DECISIONS.md](DECISIONS.md) | Decisions log: what I chose, what I rejected, and the trade-off |
| [prototype/evals/results.md](prototype/evals/results.md) | Full evaluation output |
| [tools/](tools/) | Static build for this page, browser check, publishing |

All data are synthetic. There is no real candidate data.
