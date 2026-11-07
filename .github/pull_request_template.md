## What changed

Tested nudge UI with agent integration

Re-configured nudge draft UI

## Why

The UI must be tested to ensure that all features (running the agent, drafts for this week, approval process, etc.) work as intended.
The nudge draft UI was re-configured in changing text color so that it is readable.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] `pnpm test`
- [x] `pnpm test:integration`
- [x] `pnpm dev`
- [x] `supabase test db`

Initially, the `run agent` button was not working, so I troubleshot with Claude and made a few changes to `apps/web/src/app/dashboard/_components/draft-card.tsx` for efficient agent translation and `apps/web/src/lib/agent/run.ts` (among other files) to fix no `is_error` appearing.

## Notes / screenshots

<img width="419" height="72" alt="pnpm test success" src="https://github.com/user-attachments/assets/9dfb2320-b29e-4b08-b1a7-bd47da20116d" />
<img width="678" height="44" alt="supabase test db success" src="https://github.com/user-attachments/assets/fc43112d-d26f-4df4-9c95-334418bc7b9f" />
<img width="300" height="201" alt="pnpm typecheck & pnpm lint success" src="https://github.com/user-attachments/assets/55bd946f-bebf-4b15-a008-44c06bcd1e3c" />

