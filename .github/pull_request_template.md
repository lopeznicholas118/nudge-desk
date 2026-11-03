## What changed

Implemented server and review actions

Added translateText

## Why

Server and review actions are necessary since every action re-checks the user and filters by `user_id` and by their expected state.
The `translateText()` procedure is necessary given the bilingual capabilities of the agaent.

## How I tested
- [x] `pnpm typecheck`

The `packages/agent/src/index.ts` file needed to export `translate.ts` in order for this command to run smoothly.

## Notes / screenshots

<img width="285" height="154" alt="pnpm typecheck success" src="https://github.com/user-attachments/assets/00a45e0f-0679-47d6-9996-f16bae163790" />
