## What changed

Added integration and isolation tests with a mutation

Updated cron nudges with nudge creation and agent implementation

## Why

The integration tests are separate from the other tests, verifying that the real Supabase database is used.
Implementing the agent is necessary for nudges to be created.

## How I tested
- [x] `pnpm test:integration`
- [x] `supabase test db`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] `pnpm test`
- [x] `pnpm dev`

I included a mutation check of `apps/web/src/lib/google/apply.ts`, deleting the `.eq("user_id", userId)` line after `.delete()`, leading to the "writes only to the target user" test to fail since Bob's `b-future` meeting is gone.

## Notes / screenshots

<img width="680" height="240" alt="All integration tests passing" src="https://github.com/user-attachments/assets/db005ce2-3c04-44df-97b1-056e04f84e59" />
<img width="742" height="364" alt="Failed target user test" src="https://github.com/user-attachments/assets/95c52351-650e-44ea-91d2-426b407abf4c" />
<img width="652" height="608" alt="Nudge drafts on dashboard" src="https://github.com/user-attachments/assets/c3a9701a-1427-4dd8-86fe-509c4142f8be" />







