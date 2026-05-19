-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Groups table
create table groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  creator_email text not null,
  season_type   text not null default 'summer_2026', -- 'summer_2026' | 'custom'
  range_start   date,
  range_end     date,
  invite_token  uuid not null default gen_random_uuid(),
  created_at    timestamptz default now()
);

-- Weekends table (pre-seeded per group on creation)
create table weekends (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  label       text,             -- "Memorial Day Weekend", etc.
  sort_order  int not null,
  created_at  timestamptz default now()
);

-- Members table (no auth — identified by member_token stored in localStorage)
create table members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  name         text not null,
  member_token uuid not null default gen_random_uuid(),
  created_at   timestamptz default now()
);

-- Availability table
create table availability (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  weekend_id  uuid not null references weekends(id) on delete cascade,
  status      text not null check (status in ('available', 'busy')),
  updated_at  timestamptz default now(),
  unique(member_id, weekend_id)
);

-- Indexes
create index on weekends(group_id, sort_order);
create index on members(group_id);
create index on members(member_token);
create index on availability(weekend_id);
create index on groups(invite_token);

-- Row-level security
alter table groups     enable row level security;
alter table weekends   enable row level security;
alter table members    enable row level security;
alter table availability enable row level security;

-- Public read for groups (needed to resolve invite_token → group)
create policy "groups_read" on groups for select using (true);

-- Public read for weekends within a group
create policy "weekends_read" on weekends for select using (true);

-- Anyone can create a group
create policy "groups_insert" on groups for insert with check (true);

-- Anyone can seed weekends (done server-side on group creation)
create policy "weekends_insert" on weekends for insert with check (true);

-- Anyone can join a group (create a member row)
create policy "members_insert" on members for insert with check (true);

-- Members are publicly readable within a group
create policy "members_read" on members for select using (true);

-- Anyone can read availability
create policy "availability_read" on availability for select using (true);

-- Anyone can insert availability
create policy "availability_insert" on availability for insert with check (true);

-- Members can update their own availability (matched by member_id)
create policy "availability_update" on availability for update using (true);

-- ── V2: Weekend Plans ────────────────────────────────────────────────────

create table plans (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  weekend_id  uuid not null references weekends(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  title       text not null,
  created_at  timestamptz default now()
);

create table plan_commits (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  status      text not null check (status in ('in', 'pass')),
  created_at  timestamptz default now(),
  unique(plan_id, member_id)
);

create index on plans(weekend_id);
create index on plan_commits(plan_id);

alter table plans         enable row level security;
alter table plan_commits  enable row level security;

create policy "plans_read"          on plans         for select using (true);
create policy "plans_insert"        on plans         for insert with check (true);
create policy "plan_commits_read"   on plan_commits  for select using (true);
create policy "plan_commits_insert" on plan_commits  for insert with check (true);
create policy "plan_commits_update" on plan_commits  for update using (true);
create policy "plan_commits_delete" on plan_commits  for delete using (true);

-- ── V3: Plan comments ─────────────────────────────────────────────────────

create table plan_comments (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

create index on plan_comments(plan_id);

alter table plan_comments enable row level security;

create policy "plan_comments_read"   on plan_comments for select using (true);
create policy "plan_comments_insert" on plan_comments for insert with check (true);

-- ── V4: User identity layer ───────────────────────────────────────────────────

create table user_identities (
  id             uuid primary key default gen_random_uuid(),
  user_token     uuid not null default gen_random_uuid(),
  email          text not null,
  email_verified boolean not null default false,
  created_at     timestamptz default now(),
  unique(email),
  unique(user_token)
);

create table email_claim_tokens (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null default gen_random_uuid(),
  email      text not null,
  used_at    timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now(),
  unique(token)
);

create index on user_identities(user_token);
create index on user_identities(email);
create index on email_claim_tokens(token);

alter table user_identities enable row level security;
create policy "user_identities_insert" on user_identities for insert with check (true);
create policy "user_identities_select" on user_identities for select using (true);

alter table email_claim_tokens enable row level security;
create policy "email_claim_tokens_insert" on email_claim_tokens for insert with check (true);

alter table members add column user_identity_id uuid references user_identities(id) on delete set null;
create index on members(user_identity_id);

alter table groups add column group_type text not null default 'seasonal'
  check (group_type in ('permanent', 'seasonal'));
