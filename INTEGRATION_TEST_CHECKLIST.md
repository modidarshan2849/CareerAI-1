# CareerAI V0.1 — Integration Test Checklist

**Status: not yet executed.** This sandbox has no network access to a live Supabase project
or a real browser, so nothing below has been run. Every step lists an exact action and an
exact expected result so a person or a Testing Agent can execute this against a real
deployment without needing to interpret intent.

Use two accounts: **User A** (steps 1–44, 51–59) and **User B** (steps 45–50, privacy).

---

## Authentication

| # | Step | Expected result |
|---|------|------------------|
| 1 | Register a new account with a real email + password (8+ chars) | Success screen: "Check your inbox" |
| 2 | Verify OTP/email via the confirmation link | Redirects to `/auth/callback`, then to `/dashboard`; session is active |
| 3 | Login with the confirmed account | Redirects to `/dashboard`, shows "Step 1 of 3 — Upload your resume" |
| 4 | Logout | Redirects to `/login`; session cookie cleared |
| 5 | Login again with the same credentials | Returns to `/dashboard` with prior state intact (not reset to "Step 1") |
| 6 | Refresh the browser while logged in on `/dashboard` | Page reloads with the same authenticated state, no forced re-login |
| 7 | Go to `/forgot-password`, submit the account's email | Success message: "Check your inbox" (shown even for non-existent emails — no account enumeration) |
| 8 | Click the reset link in the email | Lands on `/reset-password`, NOT redirected to `/dashboard` first |
| 9 | Submit a new password (8+ chars, matching confirmation) | "Password updated," auto-redirects to `/dashboard` after ~1.5s |
| 10 | Logout, then login using the NEW password | Succeeds; old password no longer works |
| 11 | While logged out, directly navigate to `/dashboard` | Redirected to `/login?next=/dashboard`, never shows dashboard content |

## Resume

| # | Step | Expected result |
|---|------|------------------|
| 12 | Upload a real PDF resume | Upload succeeds, redirects to `/profile/review` |
| 13 | Upload a real TXT resume (separate account/session, or after replacing) | Upload succeeds identically to PDF |
| 14 | Observe processing state during upload | Button shows "Uploading…" then "Processing your resume…" before redirect |
| 15 | Review the extracted profile on `/profile/review` | Every work experience entry shown matches the source resume (no invented roles) |
| 16 | Check each skill's confidence badge | No skill shows a numeric year value with an empty evidence list; skills only from a "Skills" list with no dated role show "Unverified" |
| 17 | Check for invented experience | No job title, employer, or achievement appears that isn't traceable to the uploaded resume text |
| 18 | Check a resume with an intentionally missing employment end date | That role shows a validation warning banner; "needs review" is visible on the affected entry |
| 19 | Upload a second, different resume (replace flow) | Old work experience/skills are fully replaced, not merged or duplicated with the new resume's data |

## Career domain

| # | Step | Expected result |
|---|------|------------------|
| 20 | Use/construct a resume with Sales experience (earlier) + IT/Data Analytics experience (later, current) | Both roles appear in the reviewed profile |
| 21 | Go to `/dashboard` after upload | "Your career history spans multiple areas..." prompt appears if the system can't confidently pick one; recommended domain (if any) is marked "(recommended)" |
| 22 | Confirm "Data & Analytics" as the domain | Prompt disappears; "Current direction: Data & Analytics" control appears |
| 23 | Check Total Experience (on `/profile/review`) | Includes BOTH the Sales and Data Analytics years combined |
| 24 | Check "Relevant to Data & Analytics" figure | Reflects ONLY the Data Analytics years, strictly less than the total |
| 25 | Click "Change" next to the current direction, select "Sales" | Confirmation persists; page updates |
| 26 | Check "Relevant to Sales" figure after switching | Changes to reflect the Sales years instead — a different number than step 24 |
| 27 | Check Total Experience again after switching to Sales | **Identical** to step 23 — must not change when only the domain changes |

## Career recommendations

| # | Step | Expected result |
|---|------|------------------|
| 28 | With a "Senior Data Analyst" current role, view Suggested Career Directions on `/dashboard` | "Data Analyst" (junior) does NOT appear in the list |
| 29 | Same profile | "Senior Data Analyst" (or equivalent same-level role) appears, tier BEST FIT or GOOD FIT |
| 30 | Same profile, with no leadership evidence | "Analytics Manager" (or other higher-level role) does NOT appear |
| 31 | Add leadership evidence (e.g. "Led a team of 3") to a role, re-save | "Analytics Manager" now appears, tier STRETCH, labeled "Higher-level stretch" |
| 32 | Check the STRETCH entry's gaps | Important gaps list names the specific missing skills (e.g. "Stakeholder Management: not established in profile") |
| 33 | Go to `/preferences`, set Target Role = "Data Analyst" explicitly, save | On `/dashboard`, "Data Analyst" now appears, labeled "Your target preference" — visually distinct from system suggestions, and the system's own Senior Data Analyst suggestion is unaffected |

## Preferences

| # | Step | Expected result |
|---|------|------------------|
| 34 | Set Target Roles | Saved without error |
| 35 | Set a Target Location | Saved without error |
| 36 | Toggle Remote / Hybrid / Onsite | Multiple can be selected simultaneously; all persist |
| 37 | Set a Distance/radius | Saved without error (if UI control exists; else N/A — not in current form) |
| 38 | Set Target Salary | Saved as a soft preference |
| 39 | Set Absolute Minimum Salary | Saved as a hard filter |
| 40 | Set Work Authorization text | Saved without error |
| 41 | Set Sponsorship = "Not sure / prefer not to say" | Saved as NULL (not true or false) — verify via Supabase table editor if possible |
| 42 | Click "Save and find best jobs" | Redirects to `/dashboard` |
| 43 | Refresh `/preferences` | All values from steps 34–41 are still populated in the form |
| 44 | Logout, log back in, revisit `/preferences` | Same values persist across the session boundary |
| — | Set Absolute Minimum Salary > Target Salary (e.g. min=150000, target=100000) | Rejected with "Your absolute minimum salary can't be higher than your target salary." — fixed during this audit, see `lib/validation.ts:validateSalaryPreferences`; enforced both client-side (instant feedback) and server-side (authoritative) |

## Privacy (requires User B)

| # | Step | Expected result |
|---|------|------------------|
| 45 | Register a second account, User B | Independent account created |
| 46 | User B uploads their own (different) resume | User B has their own profile, unrelated to User A |
| 47 | While logged in as User B, attempt to view User A's profile (e.g. guess/reuse a resume/work-experience ID from User A in a direct API call to `/api/profile/update`) | Request fails or returns zero affected rows — RLS blocks it at the database level |
| 48 | User B attempts to modify a work-experience row belonging to User A (direct `PATCH`-equivalent via the update API with User A's row id) | No rows updated; User A's data unchanged when checked afterward |
| 49 | Check whether User B's `/dashboard` or `/profile/review` ever displays any of User A's data | Never — User B sees only their own resume, skills, gaps, and suggestions |
| 50 | Check whether User B can see User A's job preferences or suggested roles via any page or direct query | Never — confirm via Supabase Table Editor with the `authenticated` role (not service role) impersonating User B |

## Mobile (428px viewport — iPhone Pro Max width)

| # | Step | Expected result |
|---|------|------------------|
| 51 | Set browser dev tools to 428px width | — |
| 52 | Load `/login` and `/register` | Forms fit within viewport, no horizontal scrollbar |
| 53 | Load `/profile/review` with a populated profile | Cards stack vertically; text wraps; no overflow |
| 54 | Load `/profile/upload` | Upload dropzone fits within viewport |
| 55 | Load `/dashboard` | Stat cards stack to a single column; suggested roles list is readable |
| 56 | Load `/preferences` | Form inputs are full-width and usable with touch |
| 57 | Load `/matches/[jobId]` (with at least one job in the `jobs` table) | Score cards and reasoning list fit without overflow |
| 58 | Scroll horizontally on every page above | No horizontal scroll appears on any page |
| 59 | Check the nav bar at the top | Nav links wrap or remain usable at 428px; nothing is clipped or covered |

---

## Defects Found and Fixed During This Audit

- **Salary preference validation gap:** `components/PreferencesForm.tsx` and
  `app/api/preferences/route.ts` previously accepted `absoluteMinimumSalary >
  targetSalary` with no validation. Fixed by adding `validateSalaryPreferences()` to
  `lib/validation.ts` (single implementation, used both client- and server-side).
  Regression test added in `lib/__tests__/validation.test.ts`. See
  `V0.1_LIVE_QA_STATUS.md` for details.

## Sign-off

Mark V0.1 integration-ready only once every row above shows an actual observed result
matching "Expected result" — not inferred from source code.
