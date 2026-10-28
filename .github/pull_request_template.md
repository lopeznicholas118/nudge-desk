## What changed

Incorporated environment cron with agent off

Implemented route and vercel schedule at 13:00 UTC

Troubleshot `DbClient` error with version alignment and TS server reboot

## Why

The cron must have a secret encrypted key with the agent off to not cost API usage.
The route will access the cron secret key directly.
The vercel schedule is setup for deployment.
See **How I tested** for the `DbClient` error.

## How I tested
- [x] `pnpm typecheck`

I was having an error with `SupabaseClient` and `DbClient`, with the createClient() function in `server.ts` returning as `DbClient` only in `packages/db` and not in `apps/web`. To fix this, I troubleshot with Claude and the solution was to maintain `@supabase/supabase-js` and `@supabase/postgrest-js` under the same version, with resetting the TS server (which ultimately resolved the predicament). 

## Notes / screenshots

<img width="289" height="156" alt="pnpm typecheck all passed" src="https://github.com/user-attachments/assets/74f9a789-0a28-4063-88a5-50ccb8359b20" />




