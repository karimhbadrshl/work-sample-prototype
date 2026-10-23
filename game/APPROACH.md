# Approach in one page

**Claim.** An interactive diagnostic scenario can score *how* a candidate isolates a fault (which tests they chose, in what order, at what cost), not only which part they name, and can be built so that a shared answer key is of little use.

**The task.** A packaging cell has stopped. The candidate operates the isolator, emergency stop and enable switches, tests with a voltmeter, a clamp ammeter or a known-good spare, reads the guide or asks the AI mentor, then names the failed part. The cell is a supply chain from mains to a conveyor motor and a pump motor, with 13 possible single faults (open circuits, a sagging supply, seized motors).

**Scoring (rule-based, deterministic, 100 points).**

| Part | Points | Rule |
|---|---|---|
| Accuracy | 50 | Correct part. Halved if the candidate's tests had not yet ruled out other parts (a guess). |
| Efficiency | 30 | Test cost against an efficient route, found by exhaustive search over the 23 available tests. |
| No wasted tests | 10 | Share of tests that told them something new. |
| Fits the evidence | 10 | The named part is still possible given every reading they took. |

The engine keeps the set of faults consistent with every observation. That set is what separates a diagnosis from a guess, and it is the same set that defines a test as wasted.

**The AI mentor.** It supplies what the candidate cannot know (healthy readings, what a lamp or a hum means, how the meters work). It is never given the fault, so it cannot leak it, and it declines to confirm guesses. In this demo it is a rules mock; a language-model version would sit behind a server with the same guardrails and the same test prompts.

**Anti-cheating, in layers.** (1) Each form has its own fault and part labels, generated from a seed. (2) Scoring uses the process, so a pasted answer with no supporting tests loses half the accuracy credit and all efficiency credit. (3) The mentor will not name or confirm the fault; every exchange is logged. (4) Telemetry flags (paste, copy, leaving the window, implausible speed, answer-seeking, injection attempts, unsupported correct answers) go to a human reviewer and never change the score or reject anyone. (5) In production, a short parallel-form verification would follow. Candidates are told what is recorded before they start.

**Candidate experience.** No visible countdown; scores do not use time; switches, parts and tools work from the keyboard; state is shown in words as well as colour; motion respects the reduced-motion setting.

**What is real and what is mocked.** The engine, scoring, generator and flags are real. The mentor is a rules mock. Candidates in the evaluation are simulated. Nothing here is validated against people.

**Out of scope.** Real candidate data, IRT calibration, item bank breadth (one cell, 13 fault states), proctoring, live LLM mentor.
