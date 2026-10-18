## What changed

Integrated the agent database as a Supabase migration

Tested RLS security under mutation checks

## Why

The Anthropic Claude agent needs to access information of the client to act as a personal network assistant.
RLS security must be upheld as sensitive contact information is held inside of the database.

## How I tested
- [x] `supabase status`
- [x] `supabase test db`

I utilized a mutation check in the SQL editor of the Supabase studio by implementing `grant delete on public.agent_steps to authenticated;` which led to the "append-only" test failing. I then reversed that mutation check by running `revoke delete on public.agent_steps from authenticated;` which led to all 26/26 tests passing. 

## Notes / screenshots

<img width="570" height="55" alt="All 26/26 tests passed" src="https://github.com/user-attachments/assets/6561a82f-eae5-4057-b5f2-ee12d5c9e4d7" />
<img width="559" height="73" alt="The append-only test failing" src="https://github.com/user-attachments/assets/47f7dae6-33c5-4ae3-857a-31b22a10c896" />
<img width="573" height="72" alt="Summary of mutation check" src="https://github.com/user-attachments/assets/f3a25a3f-4415-422c-817c-6ba7f0e59371" />


