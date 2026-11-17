-- Enable pgvector extension for semantic resume-to-JD matching
create extension if not exists vector;

create table if not exists verified_requisitions (
  id uuid primary key default gen_random_uuid(),
  dedup_key text unique not null,               -- canonical_company::canonical_title
  requisition_id text not null,
  title text not null,
  company text not null,
  canonical_company text not null,
  ats_platform text not null,                   -- Workday | Greenhouse | Lever | Ashby | SmartRecruiters
  location text not null,
  is_remote boolean default false,
  apply_url text not null,                      -- 100% live-verified corporate ATS link
  verification_method text not null,            -- WORKDAY_CXS_DETAIL_200 | LIVE_HTTP_200_VERIFIED
  description text not null,
  visa_sponsorship boolean default false,
  clearance_required boolean default false,
  status text not null default 'ACTIVE',        -- ACTIVE | CLOSED
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  embedding vector(768)                         -- text-embedding-004 embedding
);

-- HNSW index for sub-15ms cosine similarity search
create index if not exists idx_requisitions_embedding_hnsw
  on verified_requisitions
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Composite index for active status and recency filtering
create index if not exists idx_requisitions_active_verified
  on verified_requisitions (status, last_verified_at desc);

-- RPC for pgvector semantic search
create or replace function match_verified_requisitions(
  query_embedding vector(768),
  match_threshold float default 0.55,
  match_count int default 150
)
returns table (
  id uuid,
  dedup_key text,
  requisition_id text,
  title text,
  company text,
  canonical_company text,
  ats_platform text,
  location text,
  is_remote boolean,
  apply_url text,
  verification_method text,
  description text,
  visa_sponsorship boolean,
  clearance_required boolean,
  last_verified_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    vr.id,
    vr.dedup_key,
    vr.requisition_id,
    vr.title,
    vr.company,
    vr.canonical_company,
    vr.ats_platform,
    vr.location,
    vr.is_remote,
    vr.apply_url,
    vr.verification_method,
    vr.description,
    vr.visa_sponsorship,
    vr.clearance_required,
    vr.last_verified_at,
    1 - (vr.embedding <=> query_embedding) as similarity
  from verified_requisitions vr
  where vr.status = 'ACTIVE'
    and vr.embedding is not null
    and 1 - (vr.embedding <=> query_embedding) > match_threshold
  order by vr.embedding <=> query_embedding
  limit match_count;
$$;
