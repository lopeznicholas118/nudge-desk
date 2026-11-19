## What changed

Tested eval judge

Added edit-ratio usage metric

## Why

The eval judge needed to be tested to ensure its ability to judge drafts worked as intended.
The edit-ratio shows the user the statistics of the drafts they edited and discarded.

## How I tested
- [x] `pnpm --filter @nudge/evals test`
- [x] `pnpm typecheck`
- [x] `pnpm:usage`
- [x] `supabase test db`

The judge kept failing at "Oct", so I updated `packages/evals/src/text.ts` to include three-letter month shorthands as allowed, benign words, with a test.

## Notes / screenshots

<img width="577" height="202" alt="pnpm --filter @nudge/evals test results" src="https://github.com/user-attachments/assets/12472874-763d-46f1-9815-280ec2437751" />
<img width="658" height="58" alt="Edit-ratio usage metric" src="https://github.com/user-attachments/assets/574f8d2c-ecde-40f2-9e0c-1df7391e79fd" />


