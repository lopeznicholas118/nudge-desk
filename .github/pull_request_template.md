## What changed

Implemented draft review states in Supabase database

Incorporated pure logic and the agent package

## Why

The draft review states allow the user to view which drafts have not been sent. Approved drafts are now considered as open.
The pure logic and agent package allow for draft body validation and EN/ES translation planning.

## How I tested
- [x] `supabase test db`
- [x] `pnpm typecheck`
- [x] `pnpm --filter @nudge/core test`
- [x] `pnpm --filter @nudge/agent test`

I included two mutation checks.

One was in the database, testing the RLS privilege layer with `grant update (original_body) on public.drafts to authenticated;` with the tests "cannot rewrite the original body" and "the original body survives the edit" failing.

Another mutation check was in changing `altBody: draft.body` to `altBody: draft.altBody` in `packages/core/src/draft.ts` to see the example and property tests fail in the agent's translation.

## Notes / screenshots

<img width="672" height="42" alt="Supabase tests passing" src="https://github.com/user-attachments/assets/fdfec295-25ab-405f-88e5-2d9eff185748" />
<img width="641" height="111" alt="Supabase mutation check tests failed" src="https://github.com/user-attachments/assets/a17bf679-e004-42e5-ba89-f5e299ece3e5" />
<img width="641" height="85" alt="Supabase failed tests overview" src="https://github.com/user-attachments/assets/10630bdb-9c8b-4815-87d0-70396171f4ba" />
<img width="527" height="183" alt="Nudge core tests passing" src="https://github.com/user-attachments/assets/c54af296-5cbc-4af2-9f4b-a3ae167492b0" />
<img width="522" height="73" alt="Nudge agent tests passing" src="https://github.com/user-attachments/assets/f890769c-2435-4bc8-8453-6d29c9481943" />
<img width="541" height="121" alt="Nudge core example and property tests failed after mutation" src="https://github.com/user-attachments/assets/951706fd-51c1-449b-b7d9-b20c6513f4a9" />








