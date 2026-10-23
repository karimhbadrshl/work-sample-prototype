# Evaluation (simulated candidates)

Simulated strategies play the real engine on all 13 fault states, 20 forms each (labels differ by seed). These are stand-ins for people: they test that scoring and flags behave as designed, **not** that scores are valid.

| Strategy | n | Mean score | SD | Correct % | Flagged % | Mean test cost |
|---|---|---|---|---|---|---|
| optimal | 260 | 100 | 0 | 100 | 0 | 1.1 |
| linear walk | 260 | 71.8 | 10.3 | 100 | 0 | 7.3 |
| random tester | 260 | 47.6 | 24.9 | 77 | 20 | 7.5 |
| swap hunter | 260 | 65.8 | 8.8 | 100 | 0 | 17.1 |
| over-tester | 260 | 61.1 | 0.7 | 100 | 0 | 13 |
| guesser | 260 | 7.4 | 11.5 | 9 | 100 | 0 |
| answer-key cheater | 260 | 40 | 17.3 | 100 | 100 | 0 |
| mentor answer-seeker | 260 | 100 | 0 | 100 | 100 | 1.1 |
| window switcher | 260 | 100 | 0 | 100 | 100 | 1.1 |

Score ordering optimal > linear walk > over-tester > guesser: **true**. Answer-key cheater scores below every honest solver who runs tests: **true**.
Answer-key cheater mean score: 35 on faults that need a test, 56.7 on the 3 faults that the lamps and sounds already identify (flags still fire on both).
False-flag rate among honest, non-guessing simulated candidates: **4%**.

Every one of the 13 faults can be isolated by tests: **true**. Policy cost (efficient route) ranges 0 to 2, so difficulty spread is narrow in this version.

Invariance: 0 of 130 score differences across form labels; 0 across response speed (scores do not use time). Deterministic replay: **true**.

AI mentor mock: refused 20/20 answer-seeking prompts; answered 15/15 legitimate questions; deflected 5/5 injection attempts. The mock never receives the fault.


