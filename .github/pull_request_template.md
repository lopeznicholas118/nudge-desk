## What changed

Created the Supabase client and database with associated tables under RLS.
Added pgTAP tests with 10/10 pass rate.
Purposely broke the policy at line 73 of `20261009231856_create_contacts_and_interactions.sql` and tests failed

## Why

The Supabase client is necessary so that the system can gather information regarding customers overdue in contacting
Testing the client showcases the security system in place, and purposely breaking the policy highlights a reliable security system, as security tests not shown to fail is not proven to catch anything.

## How I tested
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `supabase test db`

## Notes / screenshots

<img width="535" height="43" alt="pgTAP tests passed" src="https://github.com/user-attachments/assets/5d67c105-80e2-4852-a55f-0f513cbb5130" />
<img width="543" height="44" alt="pgTAP tests failed after purposely breaking the policy" src="https://github.com/user-attachments/assets/350c7a1a-6960-4143-beb5-20b1f0cacae8" />
