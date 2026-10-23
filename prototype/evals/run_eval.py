"""Small evaluation: agreement with intended scores, repeat-run consistency, robustness, matched-pair fairness.

Run from the prototype folder:  python evals/run_eval.py
All data are synthetic; 'intended' scores stand in for expert human ratings.
"""
import json
import pathlib
import sys

import numpy as np
from sklearn.metrics import cohen_kappa_score, confusion_matrix

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import scorer  # noqa: E402

LABELS = [0, 1, 2, 3, 4]


def qwk(h, m): return cohen_kappa_score(h, m, weights="quadratic", labels=LABELS)
def exact(h, m): return float(np.mean(np.array(h) == np.array(m)))
def adjacent(h, m): return float(np.mean(np.abs(np.array(h) - np.array(m)) <= 1))
def smd(h, m): return float((np.mean(m) - np.mean(h)) / np.std(h, ddof=1))


def boot_ci(h, m, fn, B=2000, seed=1):
    rng = np.random.default_rng(seed); h = np.array(h); m = np.array(m); n = len(h)
    vals = []
    for _ in range(B):
        i = rng.integers(0, n, n)
        if len(set(h[i])) > 1:   # kappa undefined when a resample has one category
            vals.append(fn(h[i], m[i]))
    return [float(x) for x in np.percentile(vals, [2.5, 97.5])]


def f2(x): return f"{x:.2f}".replace("0.", ".", 1) if abs(x) < 1 else f"{x:.2f}"


def main():
    gold = json.loads((ROOT / "data/gold_set.json").read_text(encoding="utf-8"))
    rf = json.loads((ROOT / "data/robustness_and_fairness.json").read_text(encoding="utf-8"))
    lines = [f"# Evaluation results (synthetic data, mode = {scorer.MODE}, model = "
             f"{scorer.MODEL if scorer.MODE == 'live' else 'mock-rules'}, prompt = {scorer.C.PROMPT_VERSION})", ""]

    # 1. Agreement. Unscored (routed) items are counted as 0 for agreement and reported separately.
    res = [scorer.score_response(g["text"]) for g in gold]
    h = [g["intended"] for g in gold]
    m = [r["score"] if r["score"] is not None else 0 for r in res]
    lo, hi = boot_ci(h, m, qwk)
    summary = {"mode": scorer.MODE, "prompt_version": scorer.C.PROMPT_VERSION, "n": len(h),
               "qwk": qwk(h, m), "qwk_ci": [lo, hi], "exact": exact(h, m), "adjacent": adjacent(h, m),
               "smd": smd(h, m), "routed": int(sum(r["needs_review"] for r in res)), "robustness": [], "pairs": []}
    lines += ["## 1. Agreement with intended scores", "",
              f"*n* = {len(h)} invented responses spanning 0-4.", "",
              "| Statistic | Value |", "|---|---|",
              f"| Quadratic weighted kappa | {f2(qwk(h, m))} (95% bootstrap CI {f2(lo)} to {f2(hi)}) |",
              f"| Exact agreement | {exact(h, m):.0%} |",
              f"| Adjacent agreement (within 1) | {adjacent(h, m):.0%} |",
              f"| Standardised mean difference (machine - intended) | {f2(smd(h, m))} |",
              f"| Routed to human review | {sum(r['needs_review'] for r in res)} of {len(res)} |", "",
              "Confusion matrix (rows = intended, columns = machine):", "",
              "| | " + " | ".join(map(str, LABELS)) + " |", "|---" * 6 + "|"]
    cm = confusion_matrix(h, m, labels=LABELS)
    lines += [f"| **{LABELS[i]}** | " + " | ".join(map(str, row)) + " |" for i, row in enumerate(cm)]
    big = [(g["id"], g["intended"], r["score"]) for g, r in zip(gold, res) if abs(g["intended"] - (r["score"] or 0)) >= 2]
    lines += ["", "Disagreements of 2+ points: " + (", ".join(f"{i} (intended {a}, machine {b})" for i, a, b in big) or "none"), ""]

    # 2. Consistency across repeated runs
    runs = [[scorer.score_response(g["text"])["score"] for g in gold] for _ in range(3)]
    same = np.mean([len(set(col)) == 1 for col in zip(*runs)])
    lines += ["## 2. Repeat-run consistency", "",
              f"Identical score on all 3 runs: {same:.0%} of items."
              + (" Not informative in mock mode (rules are deterministic); re-run in live mode." if scorer.MODE == "mock" else ""), ""]

    # 3. Robustness
    lines += ["## 3. Robustness cases", "", "| Case | Expected | Score | Review? | Flags |", "|---|---|---|---|---|"]
    for c in rf["robustness"]:
        text = c["text"].replace("LONG_FILLER", "I really want to help. " * 120)
        r = scorer.score_response(text)
        summary["robustness"].append({"id": c["id"], "expect": c["expect"], "score": r["score"],
                                      "review": r["needs_review"], "flags": r["flags"]})
        lines.append(f"| {c['id']} | {c['expect']} | {r['score']} | {'yes' if r['needs_review'] else 'no'} | {', '.join(r['flags']) or '-'} |")
    lines.append("")

    # 4. Matched-pair fairness
    lines += ["## 4. Matched pairs (content identical, one non-construct feature changed)", "",
              "| Pair | Feature changed | Score A | Score B | Gap |", "|---|---|---|---|---|"]
    gaps = []
    for p in rf["fairness_pairs"]:
        a, b = scorer.score_response(p["a"])["score"], scorer.score_response(p["b"])["score"]
        gap = (b or 0) - (a or 0); gaps.append(gap)
        summary["pairs"].append({"id": p["id"], "feature": p["feature"], "a": a, "b": b, "gap": gap})
        lines.append(f"| {p['id']} | {p['feature']} | {a} | {b} | {gap:+d} |")
    lines += ["", f"Mean gap (B - A) = {np.mean(gaps):+.2f}; pairs with |gap| >= 1: {sum(abs(g) >= 1 for g in gaps)} of {len(gaps)}.", "",
              "## What this does not show", "",
              "- No real human ratings: 'intended' scores were written by the task author, so agreement is optimistic.",
              "- Small *n*; wide intervals. Not evidence of validity for hiring decisions.",
              "- Matched pairs test a handful of features, not adverse impact on real demographic groups.",
              ]
    out = "\n".join(lines)
    (ROOT / "evals/results.md").write_text(out, encoding="utf-8")
    summary["consistency"] = float(same)
    (ROOT / "evals/results.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")   # read by the Word write-up builder
    print(out)


if __name__ == "__main__":
    main()
