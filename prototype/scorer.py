"""Scoring pipeline: pre-checks -> LLM (or mock) -> validation -> human-review routing.

LLM_MODE=mock (default) needs no key or network. LLM_MODE=live calls the Anthropic API.
"""
import json
import os
import re

import config as C

MODE = os.getenv("LLM_MODE", "mock")
MODEL = os.getenv("LLM_MODEL", "claude-opus-5-5")

INJECTION_PATTERNS = re.compile(
    r"ignore (all |any |the )?(previous |above |prior )?instructions|system prompt|you are now|"
    r"(give|score|rate|mark) (this|me|it)( response)? (a |as )?[0-4]\b|rubric|as an ai",
    re.I,
)


# ---------- deterministic pre-checks (run in both modes, before any model call) ----------

def precheck(text: str) -> list[str]:
    """Return hard-stop flags. Any of these means: no automated score, a person looks at it."""
    words = re.findall(r"[A-Za-z']+", text)
    flags = []
    if len(words) < C.MIN_WORDS:
        flags.append("too_short")
    if len(words) > C.MAX_WORDS:
        flags.append("too_long")
    # Gibberish: very few words that contain a vowel, or most tokens are not words at all.
    tokens = text.split()
    if tokens and words:
        vowelled = sum(bool(re.search(r"[aeiouy]", w, re.I)) for w in words) / len(words)
        wordlike = len(words) / len(tokens)
        if vowelled < 0.7 or wordlike < 0.5:
            flags.append("gibberish")
    # Word lists with no sentences (keyword stuffing) are not a reply to a customer. Added in v0.2 after eval finding.
    if len(words) >= C.MIN_WORDS and len(re.findall(r"[.!?]", text)) < 2:
        flags.append("no_sentence_structure")
    return flags


# ---------- mock scorer: transparent keyword rules, a stand-in for the LLM ----------

KEYWORDS = {
    "acknowledge": r"\blate\b|wrong size|birthday|40 minutes|on hold|phone|cut off|frustrat|disappoint|understand|upset",
    "ownership": r"\bsorry\b|apologi[sz]e|our mistake|my mistake|we got (this|it) wrong|that's on us|our fault",
    "resolution": r"refund|exchange|voucher|replacement|send (you )?(the )?(right|correct)",
    "next_steps": r"\bwithin\b|working days|1-2 days|\btoday\b|\btomorrow\b|tracking|will (arrive|be|reach|receive)|confirm",
}
BLAME_OR_RUDE = r"not our fault|you should have|calm down|courier'?s fault|nothing (we|i) can do|whatever|obviously|policy is policy"
TOPIC = r"coat|order|dana|refund|exchange|birthday|size|deliver|sorry|apolog"


def _first_sentence_with(pattern: str, text: str) -> str:
    for sent in re.split(r"(?<=[.!?])\s+", text):
        if re.search(pattern, sent, re.I):
            return sent.strip()[:160]
    return ""


def mock_score(text: str) -> dict:
    ind = {}
    for k, pat in KEYWORDS.items():
        ev = _first_sentence_with(pat, text)
        ind[k] = {"present": bool(ev), "evidence": ev}
    rude = _first_sentence_with(BLAME_OR_RUDE, text)
    ind["tone"] = {"present": not rude, "evidence": rude}
    if rude:   # blaming the customer also cancels "ownership"
        ind["ownership"]["present"] = False

    flags = []
    if not re.search(TOPIC, text, re.I):
        flags.append("off_topic")
    if re.search(r"50%|half price|free coat|keep (the|both)", text, re.I):
        flags.append("outside_policy")

    n = sum(v["present"] for v in ind.values())
    if "off_topic" in flags:
        score = 0
    elif not ind["tone"]["present"]:
        score = 1
    else:
        score = {0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4}[n]
    conf = {5: 0.9, 4: 0.75, 3: 0.55, 2: 0.7}.get(n, 0.85)
    missing = [k for k, v in ind.items() if not v["present"]]
    rationale = (
        f"{n}/5 indicators found." + (f" Missing or weak: {', '.join(missing)}." if missing else "")
        + " (Mock rules scorer, not an LLM judgement.)"
    )
    return {"indicators": ind, "score": score, "rationale": rationale, "confidence": conf, "flags": flags}


# ---------- live scorer ----------

def _live_call(text: str) -> dict:
    import anthropic   # imported here so mock mode needs no SDK

    client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from the environment
    msg = client.beta.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=C.SYSTEM_PROMPT,
        # Candidate text is delimited and labelled as data; the system prompt says to ignore instructions in it.
        messages=[{"role": "user", "content": f"<response>\n{text}\n</response>"}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": C.OUTPUT_SCHEMA}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",   # if a safety classifier declines, retry on Anthropic's recommended fallback model
    )
    if msg.stop_reason == "refusal":
        raise RuntimeError("model declined to score")
    raw = next(b.text for b in msg.content if b.type == "text")
    return json.loads(raw)


def validate(out: dict, text: str) -> dict:
    """Local checks even with structured outputs: range, and that every quote really is in the response."""
    assert out["score"] in (0, 1, 2, 3, 4)
    out["confidence"] = float(min(max(out["confidence"], 0.0), 1.0))
    norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()
    for k in C.INDICATORS:
        ev = out["indicators"][k]["evidence"]
        if ev and norm(ev) not in norm(text):
            out["flags"].append(f"evidence_not_found:{k}")   # hallucinated quote -> human review
    return out


def score_response(text: str, retries: int = 1) -> dict:
    meta = {"mode": MODE, "model": MODEL if MODE == "live" else "mock-rules", "prompt_version": C.PROMPT_VERSION}
    hard = precheck(text)
    inj = bool(INJECTION_PATTERNS.search(text))
    if hard:
        return {**meta, "score": None, "indicators": {}, "confidence": 0.0, "flags": hard + (["injection_attempt"] if inj else []),
                "rationale": "Not scored automatically: " + ", ".join(hard) + ". Sent to a person.", "needs_review": True}

    out, err = None, None
    for _ in range(retries + 1):
        try:
            out = validate(mock_score(text) if MODE == "mock" else _live_call(text), text)
            break
        except Exception as e:   # bad JSON, schema miss, API error: retry once, then fail safe
            err = e
    if out is None:
        return {**meta, "score": None, "indicators": {}, "confidence": 0.0, "flags": ["scoring_error"],
                "rationale": f"Automated scoring failed ({type(err).__name__}). Sent to a person.", "needs_review": True}

    if inj and "injection_attempt" not in out["flags"]:
        out["flags"].append("injection_attempt")   # regex backstop in case the model misses it
    out["needs_review"] = bool(out["flags"]) or out["confidence"] < C.REVIEW_CONFIDENCE
    return {**meta, **out}


if __name__ == "__main__":
    import sys
    print(json.dumps(score_response(sys.stdin.read()), indent=2))
