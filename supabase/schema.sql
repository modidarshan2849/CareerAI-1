-- CareerAI V0.1 schema
-- Every table that holds user data has RLS enabled with a policy that scopes
-- rows to auth.uid(). No table below is readable/writable cross-user.
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- =========================================================================
-- RESUMES
-- =========================================================================
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null, -- path in the 'resumes' storage bucket
  format text not null check (format in ('pdf', 'docx', 'txt')),
  raw_text text,
  is_active boolean not null default true,
  uploaded_at timestamptz not null default now()
);

alter table resumes enable row level security;

create policy "resumes_select_own" on resumes
  for select using (auth.uid() = user_id);
create policy "resumes_insert_own" on resumes
  for insert with check (auth.uid() = user_id);
create policy "resumes_update_own" on resumes
  for update using (auth.uid() = user_id);
create policy "resumes_delete_own" on resumes
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- WORK EXPERIENCE
-- =========================================================================
create table if not exists work_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  job_title text not null default 'Unknown — review required',
  employer text not null default 'Unknown — review required',
  start_date date,
  end_date date,
  is_current boolean not null default false,
  responsibilities jsonb not null default '[]',
  achievements jsonb not null default '[]',
  technologies jsonb not null default '[]',
  employment_type text not null default 'unknown',
  leadership_evidence jsonb not null default '[]',
  source text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table work_experience enable row level security;

create policy "work_experience_all_own" on work_experience
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- SKILLS
-- =========================================================================
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_name text not null,
  years_of_experience numeric,
  months_of_experience numeric,
  -- 'Experience not established' is a valid value, not an error state.
  confidence text not null check (
    confidence in ('High', 'Medium', 'Low', 'Experience not established')
  ),
  evidence jsonb not null default '[]',
  source_role_ids jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Defensive DB-level constraint mirroring the app rule: a skill can never
  -- carry a numeric year value with zero evidence behind it.
  constraint skill_years_require_evidence check (
    years_of_experience is null or jsonb_array_length(evidence) > 0
  )
);

alter table skills enable row level security;

create policy "skills_all_own" on skills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- EDUCATION
-- =========================================================================
create table if not exists education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  credential text not null,
  field text,
  graduation_date date,
  source text,
  created_at timestamptz not null default now()
);

alter table education enable row level security;

create policy "education_all_own" on education
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- VALIDATION WARNINGS
-- =========================================================================
create table if not exists validation_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  related_record_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table validation_warnings enable row level security;

create policy "validation_warnings_all_own" on validation_warnings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- JOB PREFERENCES  (one row per user)
-- =========================================================================
create table if not exists job_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_roles jsonb not null default '[]',
  location text,
  radius_miles integer,
  remote boolean not null default false,
  hybrid boolean not null default false,
  onsite boolean not null default false,
  target_salary numeric,          -- soft preference, never a hard filter
  absolute_minimum_salary numeric, -- may be a hard filter
  employment_type jsonb not null default '[]',
  work_authorization text,
  visa_status text,
  sponsorship_required boolean,    -- NULL = unknown; must stay NULL until stated
  end_date date,
  -- Career-change protection: only ever set when the person explicitly
  -- confirms it (see /api/profile/confirm-domain). Never inferred silently.
  confirmed_career_domain text,
  updated_at timestamptz not null default now()
);

alter table job_preferences enable row level security;

create policy "job_preferences_all_own" on job_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- CAREER STRENGTH SNAPSHOTS  (recomputed server-side, stored for history)
-- =========================================================================
create table if not exists career_strength_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 95), -- capped, never 100
  breakdown jsonb not null,
  strengths jsonb not null default '[]',
  gaps jsonb not null default '[]',
  reasoning jsonb not null default '[]',
  computed_at timestamptz not null default now()
);

alter table career_strength_snapshots enable row level security;

create policy "career_strength_all_own" on career_strength_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- SUGGESTED ROLES
-- =========================================================================
create table if not exists suggested_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  tier text not null check (tier in ('BEST_FIT', 'GOOD_FIT', 'STRETCH')),
  rationale text not null,
  supporting_evidence jsonb not null default '[]',
  important_gaps jsonb not null default '[]',
  -- System-generated rows only ('lateral' | 'higher'). Explicit user-target
  -- roles are never persisted here — they're merged in at read time from
  -- job_preferences.target_roles via lib/roles.ts combineWithExplicitTargets(),
  -- so an explicit choice is never confused with a stored recommendation.
  seniority_relation text not null default 'lateral' check (seniority_relation in ('lateral', 'higher')),
  computed_at timestamptz not null default now()
);

alter table suggested_roles enable row level security;

create policy "suggested_roles_all_own" on suggested_roles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- JOBS  (shared reference data — readable by all authenticated users,
-- but never user-specific, so no per-row user_id / no cross-user leakage risk)
-- =========================================================================
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  employer text not null,
  location text,
  remote boolean not null default false,
  salary_min numeric,
  salary_max numeric,
  requires_sponsorship boolean, -- null = unknown, never defaulted
  requirements jsonb not null default '[]',
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

alter table jobs enable row level security;

create policy "jobs_select_authenticated" on jobs
  for select using (auth.role() = 'authenticated');

-- =========================================================================
-- MATCH RESULTS  (per user, per job — the output of the matching engine)
-- =========================================================================
create table if not exists match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  career_match integer not null,
  eligibility integer not null,
  preference_match integer not null,
  verification_confidence integer not null,
  overall_fit integer not null,
  status text not null check (status in ('GREEN', 'AMBER', 'RED')),
  hard_exclusion_reasons jsonb not null default '[]',
  reasoning jsonb not null default '[]',
  computed_at timestamptz not null default now(),
  unique (user_id, job_id)
);

alter table match_results enable row level security;

create policy "match_results_all_own" on match_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- STORAGE: resumes bucket (private; RLS on storage.objects)
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resume_files_select_own" on storage.objects
  for select using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume_files_insert_own" on storage.objects
  for insert with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resume_files_delete_own" on storage.objects
  for delete using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Upload convention: resumes/{user_id}/{resume_id}.{ext}
-- This is what makes the RLS foldername check above work correctly.
