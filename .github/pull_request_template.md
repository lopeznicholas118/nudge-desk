## What changed

Added ISO week math with nudge planning tests

Made service-role paths user-scoped, with one client type working everywhere

## Why

The nudge assistant needs to know when contacts are overdue so that the agent can alert the user, hence the ISO week math (starting Monday).
Admin and user's session client must be passed in as Supabase clients typed on the same database.

## How I tested
- [x] `pnpm --filter @nudge/core test`
- [x] `pnpm typecheck`

All 49/49 nudge planning tests passed.
After changing service-role paths to be client-scoped, I ran into a DbClient error where I had to return the DbClient in `server.ts` after troubleshooting with Claude.

## Notes / screenshots

<img width="517" height="171" alt="nudge planning tests passed" src="https://github.com/user-attachments/assets/b284d4c2-96f2-489e-b761-94d8fd439422" />
<img width="719" height="72" alt="failed typecheck from DbClient error" src="https://github.com/user-attachments/assets/a54c4921-cec2-46b4-a6a2-88288df7a322" />
<img width="302" height="154" alt="typecheck pass" src="https://github.com/user-attachments/assets/ad58e2b9-8afd-49ae-8f5b-aa99c14ba4ae" />


