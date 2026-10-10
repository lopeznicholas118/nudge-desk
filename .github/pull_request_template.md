## What changed

Incorporated Zod schemas for contacts and interactions
Added nudge scoring and ranking
Applied nudge scoring, ranking, and property tests

## Why

Incorporating the Zod schemas showcases the need to include data-validated contacts that will let the user know who is overdue to contact.
Nudge scoring and ranking is crucial for the user to know who is overdue and who is nearly overdue based on the user's preferences (close: 30 days, warm: 90 days, weak: 180 days).
Testing the implementation of scoring and ranking, as well as including property tests, is important to verify the data-validated inputs and to validate the outputs as expected.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `supabase test db`
- [x] `pnpm --filter @nudge/core test`

I implemented and utilized tests by adding test files for the scoring, ranking, and property. I also intentionally changed line 47 from `daysSince / cadenceDays` to `cadenceDays / daysSince`, which leads to the tests failing, including the property tests which elicited a shrunk counterexample and a seed.

## Notes / screenshots

<img width="518" height="123" alt="nudge tests passed" src="https://github.com/user-attachments/assets/7c3b6cd8-3d2c-4ca2-8345-488000f09960" />
<img width="530" height="124" alt="nudge tests failed after a mutation check" src="https://github.com/user-attachments/assets/c2c3aedb-4c2b-4feb-8692-cc1bb9b2dea5" />

