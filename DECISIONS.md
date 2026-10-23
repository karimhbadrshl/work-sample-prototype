# Decisions log

Appended during the session. It feeds the interview defence notes.

| # | Decision | Alternative rejected | Why | Trade-off |
|---|---|---|---|---|
| 1 | Interactive diagnostic simulator scored on process, not a restyled multiple-choice item | Conversational AI-technician item | Standardised, deterministic, auditable scoring; captures how candidates reason | Less novel conversation; more build time |
| 2 | Vanilla JS + SVG page instead of Streamlit | Streamlit/stlite shell | Real switches and lamps, instant load; one engine shared with the Node evaluation | Leaves the starter's Python toolchain |
| 3 | AI mentor gives information, never the answer; mock in the public demo | Mentor that can hint at the fault | Keeps the construct (diagnosis) and blocks answer leakage | Less helpful; help use is logged |
| 4 | Anti-cheating by design: seeded forms, process scoring, telemetry flags to human review | Proctoring / auto-rejection | Defensible and candidate-friendly; flags are evidence, not verdicts | Telemetry needs disclosure; false flags possible |
| 5 | Credit a correct answer fully only when the candidate's own tests left one part possible | Score the final answer only | A pasted or lucky answer should not equal a diagnosis; the same set defines wasted tests | Faults the lamp or sound identifies need no test, so a cheater scores higher on them; flags still fire |
| 6 | Efficiency against an exhaustive minimax route over the 11 tests | Fixed par values per item | Fair across items automatically, no hand-set numbers | Test costs (1 and 3) are placeholders to calibrate |
| 7 | Scores never use time or integrity flags | Penalise slow or flagged candidates | Accessibility and defensibility; flags are evidence for a person | A cheater who diagnoses properly keeps the score and is flagged only |
| 8 | Evaluate on simulated candidates with the same engine, in Node | Unit tests only | Shows the score separates strategies and flags behave, before any human data | Says nothing about validity or reliability with people |
| 9 | Single self-contained HTML page for the demo | Hosted server with an LLM key | Opens by double-click and on Pages; no key in the page | The live LLM mentor is described, not shown |
| 10 | Simplify to one pump line: five parts, two tools (voltmeter, spare part) | Two-line cell with six parts and a clamp ammeter | Less to learn in a short item; the reasoning is still a split-the-chain search | Fewer fault states (seven), narrow difficulty range |
| 11 | Two-stage adaptive routing on a sound diagnosis: medium, then hard or easy | Fixed item order; routing on correctness alone | Shows adaptivity with a rule-based selector; a lucky or pasted answer does not route up | Not IRT; tiers set by test count, not calibrated |
| 12 | Guided practice replaces written instructions, with Previous and Next | Instruction page | Welcoming, learn by doing, not scored | About two minutes extra |
