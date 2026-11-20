## What changed

Created CI with check, eval, and database workflows

Integrated Sentry for error checking and added /runs page

## Why

The CI is necessary for deployment.
The Sentry is necessary for error checking and an added /runs page shows all agent runs, verifying the Sentry work.

## How I tested
- [x] `gh pr checks --watch`
- [x] `pnpm typecheck`

Both `check` and `database` were failing, so, to fix `check`, I set `esbuild` to `true` and added `next typegen` to the `pnpm typecheck` command so it regenerates types and `LayoutProps` is allowed, not throwing an error. To fix `database`, the supabase version on the CI had to match my local version.
I ran a mutation check with removing the Anthropic API key, verifying the Sentry error in /runs. I then reverted the API code back and verified the Sentry worked in both cases.

## Notes / screenshots

<img width="645" height="138" alt="/runs page" src="https://github.com/user-attachments/assets/03ed4a16-3313-4eca-b87a-a108a2c9516e" />




