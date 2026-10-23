# Evaluation (simulated candidates)

Simulated strategies play the real engine on all 7 fault states, 20 forms each (labels differ by seed). These stand in for people: they test that scoring, routing and flags behave as designed, **not** that scores are valid.

| Strategy | n | Mean score | SD | Correct % | Flagged % | Mean test cost |
|---|---|---|---|---|---|---|
| optimal | 140 | 100 | 0 | 100 | 0 | 1 |
| linear walk | 140 | 83.6 | 9.3 | 100 | 0 | 3.7 |
| random tester | 140 | 60.1 | 24.6 | 86 | 13 | 5.8 |
| swap hunter | 140 | 69.9 | 10.5 | 100 | 0 | 9.4 |
| over-tester | 140 | 73 | 3.8 | 100 | 0 | 6 |
| guesser | 140 | 11.6 | 19.4 | 19 | 100 | 0 |
| answer-key cheater | 140 | 44.3 | 22.7 | 100 | 100 | 0 |
| mentor answer-seeker | 140 | 100 | 0 | 100 | 100 | 1 |
| window switcher | 140 | 100 | 0 | 100 | 100 | 1 |

Ordering optimal > linear walk > over-tester > guesser: **true**. Answer-key cheater below every honest solver that runs tests: **true**. False-flag rate among honest simulated solvers: **0%**.
Cheater mean: 35 on faults that need a test, 67.5 on the 2 faults the lamp and the motor's movement already identify (flags still fire).

Item bank: easy 2 items (efficient-route cost 0, 0); medium 3 items (efficient-route cost 1, 1, 1); hard 2 items (efficient-route cost 2, 2). Every fault can be isolated by tests: **true**.

## Adaptive routing (item 1 medium, then hard if sound, else easy)

| Strategy | Routed to hard % | Advanced % | Proficient % | Developing % | Beginning % |
|---|---|---|---|---|---|
| optimal | 100 | 100 | 0 | 0 | 0 |
| linear walk | 100 | 100 | 0 | 0 | 0 |
| random tester | 58 | 34 | 24 | 42 | 0 |
| swap hunter | 100 | 100 | 0 | 0 | 0 |
| over-tester | 100 | 100 | 0 | 0 | 0 |
| guesser | 0 | 0 | 0 | 15 | 85 |
| answer-key cheater | 0 | 0 | 0 | 50 | 50 |
| mentor answer-seeker | 100 | 100 | 0 | 0 | 0 |
| window switcher | 100 | 100 | 0 | 0 | 0 |

Invariance: 0 of 70 score differences across form labels; 0 across response speed (scores do not use time). Deterministic replay: **true**.

AI mentor mock: refused 20/20 answer-seeking prompts; answered 15/15 legitimate questions; deflected 5/5 injection attempts. The mock never receives the fault.


