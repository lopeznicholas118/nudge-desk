## What changed

Incorporated the Anthropic Claude agent

Tested agent tools and loop output

Mutated `tools.ts` to verify security system of agent tests

## Why

The agent, Nudge, must be included to serve as a personal network assistant to the user.
Agent tools must be tested to verify agent output is correct.
The mutation of `tools.ts` is necessary to validate a working security system.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm --filter @nudge/agent test`
- [x] `supabase status`

I implemented tests in `tools.test.ts` and `agent.test.ts` to verify the correct agent output regarding its functionality.
I also mutated line 181 of `tools.ts`, removing the if statement so that the "rejects a language that doesn't match the contact" test would fail.

## Notes / screenshots

<img width="563" height="180" alt="All 31/31 tests passed" src="https://github.com/user-attachments/assets/c1e5ae64-afa3-4c4d-91e2-f07a1b830e03" />
<img width="673" height="369" alt="Mutation language test failed" src="https://github.com/user-attachments/assets/469cc29c-15bb-4324-a4a3-154d06dc6cd3" />
<img width="509" height="124" alt="Tests failed after mutation" src="https://github.com/user-attachments/assets/d0b22c50-8de3-46f8-af27-2b37b175c09b" />



