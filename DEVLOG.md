# Developer Log – Nudge Desk

## October 12th, 2026

### **Incorporated** a session proxy

### **Included** Supabase integration storing the user's credentials (email/password auth) in a database

### **Created** website with simple login and dashboard

## October 10th, 2026

### **Added** Zod schemas for contacts and interactions

### **Developed** nudge scoring and ranking according to the preferences of the user

### **Tested** nudge ranking under the command `pnpm --filter @nudge/core test`
– When security is upheld, all 25 tests are passed
– When security is broken (changing `daysSince / cadenceDays` to `cadenceDays / daysSince` at line 47 of the `nudge.ts` file), multiple tests fail

## October 9th, 2026

### **Deployed** the project and configured the start page

### **Created** the GitHub repository with a pull request

### **Integrated** branch protection to block force pushes

### **Built** the database using supabase

### **Tested** the database under the command `supabase test db`
– When security is upheld, 10/10 PASS rate
– When security is broken (configuring `using = (true)` under `contacts_own` in the migration SQL file), multiple tests fail

## October 8th, 2026

### **Created** the github repository for nudge-desk

### **Downloaded** dependencies

### **Scaffolded** pnpm monorepo

### **Debugged** zsh detecting a filename wildcard which resulted in pnpm not receiving the command

### **Troubleshot** the "application path is not writable" error with Claude by creating the apps/ folder

### **Commited** the project to a local Github repository, which will be public tomorrow