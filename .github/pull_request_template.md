## What changed

Implemented runner, reports, and comparison

## Why

The eval judge must run reports and compare the nudge agent's output to test whether the output is correct.

## How I tested
- [x] `pnpm --filter @nudge/evals typecheck`
- [x] `pnpm --filter @nudge/evals test`

All tests passed. I mutated the filter of `securityFindings` in `packages/evals/src/compare.ts` from `c.passRate < 1` to `c.passRate < 0.5`. The security-findings test failed, showcasing a prominent security system.

## Notes / screenshots

<img width="626" height="155" alt="eval tests failed" src="https://github.com/user-attachments/assets/88686c5a-608c-4ec9-9d2b-6c79c0505130" />
<img width="776" height="324" alt="security-findings test failed" src="https://github.com/user-attachments/assets/76a181b8-50ed-46e9-8f79-b0341fa103b5" />
<img width="125" height="29" alt="typecheck results" src="https://github.com/user-attachments/assets/69d0161d-59dd-4879-b53a-37dc089d311b" />
<img width="530" height="188" alt="test results" src="https://github.com/user-attachments/assets/b40991b2-c551-475a-8380-55a3a7d14f8c" />



