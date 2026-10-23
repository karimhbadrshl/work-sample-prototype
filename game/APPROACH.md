# Approach in one page

**Claim.** An interactive diagnostic item can score *how* a candidate isolates a fault (which tests they chose, in what order, at what cost), not only which part they name, and can adapt and resist answer sharing.

**The task.** Pump 3 will not fill its tank. The line is a fuse, power supply, operator switch, level switch, contactor and pump motor: five parts that can fail, seven fault states. The candidate switches the pump on, tests with a voltmeter (cost 1) or a spare part (cost 3), uses the reference guide or AI mentor, and names the failed part. Fix the right part and the tank fills.

**Items and routing.** Seven fault states sit in three tiers by how many paid tests an efficient route needs: easy (0), medium (1), hard (2). Everyone starts at a medium item. A *sound* diagnosis (correct and supported by the candidate's own tests) routes to a hard item; otherwise an easy one. The two items give an illustrative band (Advanced, Proficient, Developing, Beginning). Tiers are set by search, not calibrated on data.

**Scoring (rule-based, deterministic, 100 points per item).**

| Part | Points | Rule |
|---|---|---|
| Accuracy | 50 | Correct part. Halved if the candidate's tests had not yet ruled out other parts (a guess). |
| Efficiency | 30 | Test cost against an efficient route found by exhaustive search over the 11 available tests. |
| No wasted tests | 10 | Share of tests that told them something new. |
| Fits the evidence | 10 | The named part is still possible given every reading they took. |

The engine keeps the set of faults consistent with every observation. That set separates a diagnosis from a guess and defines a wasted test.

**The AI mentor.** It supplies what the candidate cannot know (healthy readings, what a lamp or a hum means, how the meter works). It is never given the fault, so it cannot leak it, and it declines to confirm guesses. In this demo it is a rules mock; a language-model version would sit behind a server with the same guardrails and prompts.

**Anti-cheating, in layers.** (1) Each item has its own fault and part labels from a seed. (2) Scoring and routing use the process, so a pasted answer with no supporting tests loses half the accuracy credit, all efficiency credit, and is not routed up. (3) The mentor will not name or confirm the fault; every exchange is logged. (4) Telemetry flags (paste, copy, leaving the window, implausible speed, answer-seeking, injection attempts, unsupported correct answers) go to a human reviewer and never change the score. (5) In production, a short parallel-form verification would follow. Candidates are told what is recorded before they start.

**Candidate experience.** A guided practice with Previous and Next; no visible countdown; scores do not use time; keyboard access; state in words as well as colour; reduced-motion respected.

**Real and mocked.** The engine, scoring, routing, generator and flags are real. The mentor is a rules mock. Candidates in the evaluation are simulated. Nothing is validated against people.

**Out of scope.** Real candidate data, IRT calibration, item bank breadth (one line, seven fault states), proctoring, live LLM mentor.
