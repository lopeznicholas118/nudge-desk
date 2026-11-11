## What changed

Added eval graders, fixtures, and cases

Implemented mutation checks (see the "How I tested" section)

## Why

The agent's output must be tested under fixtures, graders, and eval cases so that it passes all tests and functions as intended.
The mutation check ensures a reliable security system with tool layer rejection.

## How I tested
- [x] `pnpm --filter @nudge/evals typecheck`
- [x] `pnpm --filter @nudge/evals test`

All tests passed. I ran a mutation check omitting the `...attempted` in `const haystack` inside the `forbiddenStrings` block of `graders.ts`. I then ran `pnpm --filter @nudge/evals test`, leading to the “catches a canary in a rejected save_draft attempt” test to fail. This is the injection-tool-misuse scenario, where the model attempts to save the planted draft but the tool layer rejects it.

## Notes / screenshots

<img width="732" height="320" alt="canary catched test failed" src="https://github.com/user-attachments/assets/806ec6cd-cee0-4e75-ba9e-7a59a94d0119" />
<img width="613" height="150" alt="failed pnpm evals tests overview" src="https://github.com/user-attachments/assets/f43ff238-6f07-49fb-98d3-f842737d537b" />
<img width="126" height="25" alt="pnpm evals typecheck output" src="https://github.com/user-attachments/assets/7401bfb8-c3c3-4ac0-9b22-54ad7787d2fc" />
<img width="494" height="140" alt="pnpm evals tests passed" src="https://github.com/user-attachments/assets/cbf6fc5e-5c96-4ad7-bf4b-8352363e6bc5" />


