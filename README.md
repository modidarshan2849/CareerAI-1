# CareerAI V0.1

Evidence-first AI career assistant. "Stop applying everywhere. Target the jobs you can actually win."

Built fresh (not a Lovable export) — Next.js 15 (App Router) + Supabase + TypeScript.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the schema**: open the SQL editor in your Supabase dashboard, paste the contents of
   `supabase/schema.sql`, and run it. This creates all tables, RLS policies, and the private
   `resumes` storage bucket.
3. **Enable Google OAuth (optional)**: Authentication → Providers → Google, if you want the
   "Continue with Google" button to work. The code is already wired for it; it just needs the
   provider configured on Supabase's side.
4. **Copy `.env.example` to `.env.local`** and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Project Settings → API.
   - `ANTHROPIC_API_KEY` — powers resume extraction in `lib/profileAI.ts`.
5. **Install and run**:
   ```
   npm install
   npm run dev
   ```
6. **Run the business-logic test suite** (no external services needed):
   ```
   npm run test:logic
   ```

## What's real vs. what's ready-to-test

This was built in a sandboxed environment with no network access, so dependencies couldn't be
installed and Next.js/Supabase couldn't actually be run end-to-end. To be precise about what that
means for each part — using the same 🟢/🟡/🔴/⚪ system requested for this project:

- 🟢 **VERIFIED (actually run, with real assertions)**: every function in `lib/experience.ts`,
  `lib/skills.ts`, `lib/matching.ts`, `lib/validation.ts`, `lib/careerStrength.ts`, `lib/gaps.ts`,
  `lib/roles.ts`, `lib/careerLevel.ts`, `lib/careerDomain.ts`, `lib/recompute.ts`, and PDF/TXT
  extraction in `lib/parsing/extractText.ts`. 162 assertions pass across 12 test files — see
  `lib/__tests__/`. This includes a **static wiring audit** (`wiringAudit.test.ts`) that inspects
  the actual route source files to confirm resume upload, profile edits, and domain confirmation
  all call the single shared `recomputeDerivedProfile()` path, and that no route duplicates the
  underlying calculation logic. The pure business-logic layer (12 files, no framework deps) also
  passes a strict `tsc --noEmit` typecheck with zero errors.
- 🟡 **CODE VERIFIED (written, internally consistent, not runtime tested)**: all Next.js pages, API
  routes, the Supabase schema/RLS policies, the auth/middleware flow, and DOCX extraction (mammoth
  couldn't be installed offline). These need `npm install` in an environment with network access,
  then real testing against a live Supabase project — see `INTEGRATION_TEST_CHECKLIST.md` for the
  exact manual/Testing Agent sequence to run once deployed.

Don't take "CODE VERIFIED" as "done" — treat it as "reviewed and structurally sound, first real
test still pending."

## Project structure

```
lib/                      Pure business logic (fully tested, zero external deps)
  types.ts                 Master Career Profile data model
  experience.ts             Interval-union experience calculation
  skills.ts                 Evidence-gated skill years
  careerStrength.ts          Score capped at 95
  gaps.ts                    Dynamic career gap detection
  roles.ts                   BEST_FIT / GOOD_FIT / STRETCH tiering
  matching.ts                 Four-score matching engine + Green/Amber/Red
  validation.ts                Section 12 checklist
  profileAI.ts                  LLM resume extraction (needs ANTHROPIC_API_KEY)
  parsing/extractText.ts         PDF/DOCX/TXT text extraction
  data.ts                          Supabase → domain-type mapping
  __tests__/                        Real, runnable tests (npm run test:logic)

app/                       Next.js App Router pages + API routes
components/                Nav, EvidenceChip, StatusPill, forms
supabase/schema.sql        Tables + RLS policies + storage bucket policy
middleware.ts              Auth guard + password-recovery routing
```

## Live QA status

See `V0.1_LIVE_QA_STATUS.md` for the full area-by-area status table, and
`INTEGRATION_TEST_CHECKLIST.md` for the exact step-by-step manual/Testing Agent sequence to
run once deployed with real Supabase credentials.

## Test fixtures

`scripts/candidateAFixture.ts` is a deterministic, pure-data profile ("Candidate A") covering
every hard case in one place: a Sales→Data Analytics career change, deliberately overlapping
employment dates, a skill with no supporting evidence, and a Senior Data Analyst current role
for seniority-protection testing. It's exercised directly by `lib/__tests__/candidateAFixture.test.ts`.

To seed this fixture into a REAL Supabase project for manual live QA (never runs automatically):
```
npx tsx scripts/seed-candidate-a.ts --user-id=<real auth.users id> --confirm
```
Omit `--confirm` for a dry run that prints what it would do without touching the database.
Requires `SUPABASE_SERVICE_ROLE_KEY` in the environment (not the anon key) since it writes
directly to a specific user's rows.

## Known limitations to close before Phase 2


- Word-boundary skill matching in `lib/skills.ts` is regex-based; a dedicated NLP/embedding
  approach would catch more synonyms ("JS" vs "JavaScript") without false positives.
- `lib/profileAI.ts` calls Anthropic directly from a Next.js API route; for production you'll want
  retry/backoff and a hard timeout so a slow extraction doesn't hang the upload request.
- The matching engine's weights (`lib/matching.ts`) are reasonable starting defaults, not tuned
  against real user outcomes yet.
