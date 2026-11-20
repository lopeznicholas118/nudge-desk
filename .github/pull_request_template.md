## What changed

Created CI with check, eval, and database workflows

## Why

The CI is necessary for deployment.

## How I tested
- [x] `gh pr checks --watch`
- [x] `pnpm typecheck`

Both `check` and `database` were failing, so, to fix `check`, I set `esbuild` to `true` and added `next typegen` to the `pnpm typecheck` command so it regenerates types and `LayoutProps` is allowed, not throwing an error. To fix `database`, the supabase version on the CI had to match my local version.

## Notes / screenshots

<img width="357" height="55" alt="apps/web pnpm typecheck after regeneration" src="https://github.com/user-attachments/assets/53168a3e-d2f9-4e95-8d5d-c481e2247d97" />
<img width="219" height="48" alt="both checks passed" src="https://github.com/user-attachments/assets/c016266b-97b8-46b4-81de-d69c25ffa037" />



