## What changed

Installed eval dependencies

Added eval judge agent

## Why

The eval dependencies need to be installed to run tests and to evaluate the nudge agent to ensure it is working correctly. The same is true for the eval judge agent.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] `supabase test db`

All tests passed.

## Notes / screenshots

<img width="574" height="56" alt="supabase test db all tests passed" src="https://github.com/user-attachments/assets/98141dbb-da3e-4d20-821a-75c50ed04c3e" />
<img width="281" height="158" alt="pnpm typecheck tests passed" src="https://github.com/user-attachments/assets/313a0035-3bd6-480e-a7e9-6bcd94acb3d9" />

