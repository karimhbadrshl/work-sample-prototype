# Decisions log

Appended during the session. It feeds the decisions table in the Word write-up and the interview defence notes.

| # | Decision | Alternative rejected | Why | Trade-off |
|---|---|---|---|---|
| 1 | Interactive diagnostic simulator scored on process, not a restyled multiple-choice item | Conversational AI-technician item | Standardised, deterministic, auditable scoring; captures how candidates reason | Less novel conversation; more build time |
| 2 | Vanilla JS + SVG page instead of Streamlit | Streamlit/stlite shell | Real switches and gauges, instant load; one engine shared with the Node evaluation | Leaves the starter's Python toolchain; need new build/test steps |
| 3 | AI mentor gives information, never the answer; mock in public demo | Mentor that can hint at the fault | Keeps the construct (diagnosis) and blocks answer leakage | Less helpful; help use is logged |
| 4 | Anti-cheating by design: seeded parameterised faults, process scoring, telemetry flags to human review | Proctoring / auto-rejection | Defensible and candidate-friendly; flags are evidence, not verdicts | Telemetry needs disclosure; false flags possible |
| 5 | Hypothesis-set scoring: a correct answer is credited fully only when the candidate's own tests left one part possible | Score the final answer only | A pasted or lucky answer should not equal a diagnosis; the same set defines wasted tests | Early-identifying faults (lamps, hum) need no test, so a cheater scores higher on them; flags still fire |
| 6 | Efficiency measured against an exhaustive minimax route over the 23 tests | Fixed par values per form | Fair across forms automatically, no hand-set numbers | Assumes tests cost 1 or 3 as designed; costs are placeholders to calibrate |
| 7 | Scores never use time or integrity flags | Penalise slow or flagged candidates | Accessibility and defensibility; flags are evidence for a person, not a verdict | A cheater who solves it properly keeps the score and gets flagged only |
| 8 | Evaluate on simulated candidates with the same engine, in Node | Unit tests only; no evaluation | Shows the score separates strategies and flags behave, before any human data | Says nothing about validity or reliability with people |
| 9 | Single self-contained HTML page for the demo | Hosted server with an LLM key | Opens by double-click and on Pages; no key in the page | The live LLM mentor is described, not shown |
