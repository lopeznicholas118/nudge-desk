## What changed

Implemented Anthropic Claude AI eval judge

Added hand-picked calibration set

## Why

The eval judge will ensure that the nudge agent's outputs match the appropriate style and format of the message, not being unprofessional while also not referring to events that never occurred with the person nor regurgitating cliché's.
The hand-picked calibration set is necessary for the eval judge to know which responses are acceptable and which are not so that it can test the correct response type for the nudge agent.

## How I tested
- [x] `pnpm --filter @nudge/evals typecheck`
- [x] `pnpm --filter @nudge/evals test`

All tests passed.

## Notes / screenshots

<img width="483" height="191" alt="pnpm tests passed with pnpm typecheck below" src="https://github.com/user-attachments/assets/8728dc47-d7d9-4cd6-b42a-7f9439dd3ede" />



