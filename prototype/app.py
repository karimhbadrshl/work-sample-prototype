"""Streamlit front end: candidate view (task + reply) and recruiter view (score, evidence, review routing).
Tabs for evidence and approach make the hosted copy self-contained for non-technical reviewers.

Run from the repo root:  streamlit run prototype/app.py
(LLM_MODE=mock by default; set LLM_MODE=live and ANTHROPIC_API_KEY for the real model.)
"""
import json
import pathlib
import sys

import streamlit as st

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))   # so local modules import the same way locally and in the browser build

import brand  # noqa: E402
import config as C  # noqa: E402
import scorer  # noqa: E402

IN_BROWSER = sys.platform == "emscripten"   # True in the static HTML build (Pyodide)

st.set_page_config(page_title="Work sample prototype", layout="wide")
brand.apply(C.APP_KICKER, C.APP_TITLE)
if getattr(C, "EXAMPLE_CONTENT", False):
    st.warning("Starter example content. Replace the task in prototype/config.py and set EXAMPLE_CONTENT = False.")
st.markdown(C.SHORT_DESCRIPTION)

if scorer.MODE == "mock":
    st.info(
        "**How to use this demo.** 1) In *Try the task*, pick an example from the drop-down or write your own reply. "
        f"2) Press **{C.SUBMIT_LABEL}**. 3) The right-hand side shows what a recruiter would see: the score, the evidence "
        "for it, and whether a person needs to review it.  \n"
        "This copy runs in **mock mode**: a simple, transparent rules scorer stands in for the AI model, so it is free "
        "and needs no API key. The AI scorer is in the code and described under *Approach*."
        + ("  \nEverything runs in your browser. Nothing you type is sent anywhere." if IN_BROWSER else "")
    )

tab_try, tab_eval, tab_approach = st.tabs(["Try the task", "Evidence", "Approach"])

with tab_try:
    left, right = st.columns(2)

    with left:
        st.subheader("Candidate view")
        st.markdown("**Customer email**")
        # Quote block wraps long lines; escape a leading "-" so the sign-off isn't drawn as a bullet.
        st.markdown("\n".join("> " + line.replace("- ", "\\- ", 1) if line.startswith("- ") else "> " + line
                              for line in C.CUSTOMER_EMAIL.splitlines()))
        st.markdown(C.POLICY_NOTES.replace("\n", "  \n"))
        st.markdown(f"**{C.CANDIDATE_INSTRUCTIONS}**")

        gold = json.loads((HERE / "data/gold_set.json").read_text(encoding="utf-8"))
        rf = json.loads((HERE / "data/robustness_and_fairness.json").read_text(encoding="utf-8"))
        examples = {"(write your own)": ""}
        examples |= {f"{g['id']}: intended score {g['intended']}": g["text"] for g in gold}
        examples |= {f"{c['id']}: robustness test": c["text"] for c in rf["robustness"] if "LONG_FILLER" not in c["text"]}
        pick = st.selectbox("Load a synthetic example", list(examples))
        # Key per example: otherwise Streamlit keeps the old text when a different example is picked.
        text = st.text_area("Your reply", value=examples[pick], height=260, key=f"reply::{pick}")
        st.caption(f"{len(text.split())} words")
        go = st.button(C.SUBMIT_LABEL, type="primary")

    with right:
        st.subheader("Recruiter view")
        if go:
            r = scorer.score_response(text)
            if r["score"] is None:
                st.warning("Not scored automatically. Sent to a trained reviewer.")
            else:
                st.metric("Score (0-4)", r["score"], help="Holistic rubric score; see indicators below")
            if r["needs_review"]:
                st.error("Human review required: " + (", ".join(r["flags"]) or f"confidence {r['confidence']:.2f} below {C.REVIEW_CONFIDENCE}"))
            else:
                st.success(f"No review flag (confidence {r['confidence']:.2f})")
            st.markdown(f"**Rationale:** {r['rationale']}")
            if r["indicators"]:
                st.markdown("**Indicators and evidence from the reply**")
                for k, desc in C.INDICATORS.items():
                    v = r["indicators"][k]
                    ev = f" “{v['evidence']}”" if v["evidence"] else ""
                    label = "present" if v["present"] else "missing"
                    st.markdown(f"{brand.tag(label, v['present'])} **{k}**: {desc}{ev}", unsafe_allow_html=True)
            with st.expander("Audit record (what would be logged)"):
                st.json(r)
        else:
            st.info(f"Press {C.SUBMIT_LABEL} to see the score, evidence and review routing.")

    with st.expander("Scoring rubric"):
        st.text(C.RUBRIC)

def show_md(path: pathlib.Path, missing: str):
    st.markdown(path.read_text(encoding="utf-8") if path.exists() else missing)


with tab_eval:
    show_md(HERE / "evals/results.md", "No results yet: run `python prototype/evals/run_eval.py`.")

with tab_approach:
    show_md(HERE / "APPROACH.md", "Approach summary not written yet.")

brand.footer("Scores support, and do not replace, a recruiter's decision. Flagged or low-confidence replies always go to a person.")
