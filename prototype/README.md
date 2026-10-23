# Prototype: technical README

[EDIT: two sentences: what the candidate does, what is scored, on what scale, and what each score comes with.] All content is synthetic.

## Run locally (mock mode: no key, no network)

From the repo root:

```bash
python -m venv .venv
.venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
pip install -r prototype/requirements.txt
streamlit run prototype/app.py
python prototype/evals/run_eval.py   # writes prototype/evals/results.md and results.json
```

## Live mode (Anthropic API)

```bash
set LLM_MODE=live                 # PowerShell: $env:LLM_MODE="live"
set ANTHROPIC_API_KEY=...         # never in a file
set LLM_MODEL=claude-opus-5-5     # optional; this is the default
```

Live calls use structured outputs (the JSON schema is in `config.py`), one retry and server-side refusal fallback. Output is validated locally. Current Claude models don't accept `temperature`, so repeat-run consistency has to be measured.

## Static browser build (the public demo)

`python tools/build_static.py` writes `docs/index.html`, which runs this app in the browser with [stlite](https://github.com/whitphx/stlite) v1.9.2, always in mock mode. GitHub Pages serves it from `/docs`. Re-run it after any change here.

## Files

| File | What it is |
|---|---|
| `config.py` | Task content, indicators, rubric, prompt, output schema, version label, app title |
| `scorer.py` | Pre-checks, then mock or live scorer, then validation, then review routing |
| `app.py` | UI: candidate view and recruiter view, audit record; tabs for evidence and approach |
| `brand.py` | Visual identity; theme colours in `../.streamlit/config.toml` |
| `APPROACH.md` | One-screen summary shown in the app |
| `data/` | Synthetic responses with intended scores; robustness cases and matched pairs |
| `evals/` | Evaluation script and results |

## Known limits

- [EDIT: what was not tested, e.g. whether the live LLM was run end to end]
- [EDIT: data limits]
