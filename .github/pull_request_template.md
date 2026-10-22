## What changed

Integrated the nudges database

Added RLS and constraint tests

Mutated database to verify RLS layer tests and security system

## Why

The nudges database sets up the daily cron which generates nudges idempotently.
The RLS and constraint tests must verify that there are no silent bypasses to the security system.
Mutating the database verifies RLS to ensure that INSERT is flagged correctly.

## How I tested
- [x] `supabase test db`

All 39/39 tests passed.
I mutated the database in the SQL studio using the command `grant insert on public.nudges to authenticated`. Initially, all tests kept passing, so I troubleshot with Claude and the solution was to declare the message type explicitly (no INSERT privilege) inside of the sql check in the `nudges.test.sql` file. Then, the command led to the failure of the `signed-in users cannot create nudges` test as intended. Revoking the command led to the tests passing again. I then re-edited `google-connections.test.sql` to include the fix. See screenshots below.

## Notes / screenshots

<img width="685" height="40" alt="All tests passed" src="https://github.com/user-attachments/assets/9c181e37-70b3-408c-be0c-5a6ae9e86682" />
<img width="640" height="85" alt="Nudges test failed" src="https://github.com/user-attachments/assets/b00e3fda-e3bb-41f3-87a7-961343906393" />
<img width="620" height="71" alt="signed-in users cannot create nudges test failed after mutating" src="https://github.com/user-attachments/assets/d969a603-7e23-4c23-bc0d-a6ed94f4711e" />
<img width="665" height="70" alt="Google connections tests failed" src="https://github.com/user-attachments/assets/fc2ed016-3bc7-49a1-9b42-1d43960e086c" />
<img width="687" height="69" alt="Google connections test (no INSERT privilege) failed after mutating" src="https://github.com/user-attachments/assets/69931fa6-4b77-43a9-835f-1f61d1d35fe4" />



