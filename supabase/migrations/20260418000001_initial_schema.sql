-- ============================================================
-- BullFin-AI — initial schema
-- Author: Phase 1 scaffold (2026-04-18)
--
-- Design notes:
--   - Auth lives in Supabase `auth.users`; we mirror public-safe
--     fields into `public.user_profiles` and link everything to it.
--   - Every user-owned table enforces ownership via Row-Level
--     Security. Never disable RLS on these tables.
--   - All timestamps are `timestamptz` and default to now().
--   - A trigger keeps `updated_at` fresh on UPDATE.
-- ============================================================

-- ---- Extensions ----
create extension if not exists "pgcrypto"  with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";
create extension if not exists "citext"    with schema "extensions";

-- ============================================================
-- Reusable helpers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- user_profiles — mirrors auth.users with public-safe fields
-- ============================================================

do $$ begin
  create type public.user_role as enum ('investor', 'advisor', 'admin');
exception
  when duplicate_object then null;
end $$;

create table public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       extensions.citext not null unique,
  full_name   text,
  role        public.user_role not null default 'investor',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- portfolios — a named container of holdings
-- ============================================================

create table public.portfolios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.user_profiles(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  description    text check (char_length(description) <= 2000),
  base_currency  char(3) not null default 'USD',
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index portfolios_user_id_idx on public.portfolios(user_id);
create index portfolios_user_active_idx
  on public.portfolios(user_id)
  where is_archived = false;

create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

-- ============================================================
-- holdings — individual lots inside a portfolio
-- ============================================================

create table public.holdings (
  id               uuid primary key default gen_random_uuid(),
  portfolio_id     uuid not null references public.portfolios(id) on delete cascade,
  symbol           text not null check (symbol = upper(symbol) and char_length(symbol) between 1 and 12),
  shares           numeric(20, 6) not null check (shares > 0),
  purchase_price   numeric(20, 6) not null check (purchase_price >= 0),
  purchase_date    date not null,
  sector           text,
  notes            text check (char_length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index holdings_portfolio_id_idx on public.holdings(portfolio_id);
create index holdings_symbol_idx on public.holdings(symbol);

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

-- ============================================================
-- chat_sessions + chat_messages — Gemini advisor conversations
-- ============================================================

do $$ begin
  create type public.chat_role as enum ('user', 'assistant', 'system');
exception
  when duplicate_object then null;
end $$;

create table public.chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  portfolio_id  uuid references public.portfolios(id) on delete set null,
  title         text not null default 'New conversation' check (char_length(title) <= 160),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index chat_sessions_user_id_idx on public.chat_sessions(user_id);
create index chat_sessions_portfolio_idx on public.chat_sessions(portfolio_id);

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        public.chat_role not null,
  content     text not null check (char_length(content) <= 20000),
  created_at  timestamptz not null default now()
);

create index chat_messages_session_idx on public.chat_messages(session_id, created_at);

-- ============================================================
-- reports — generated PDFs stored in Supabase Storage
-- ============================================================

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  title         text not null check (char_length(title) <= 200),
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

create index reports_user_id_idx on public.reports(user_id);
create index reports_portfolio_id_idx on public.reports(portfolio_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.user_profiles enable row level security;
alter table public.portfolios    enable row level security;
alter table public.holdings      enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reports       enable row level security;

-- user_profiles: owner can read/update their own row.
create policy user_profiles_self_select
  on public.user_profiles for select
  using (auth.uid() = id);

create policy user_profiles_self_update
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- portfolios: owner-only CRUD.
create policy portfolios_owner_all
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- holdings: accessible only through a portfolio owned by the caller.
create policy holdings_owner_all
  on public.holdings for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    )
  );

-- chat_sessions: owner-only.
create policy chat_sessions_owner_all
  on public.chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chat_messages: accessible only through a session owned by the caller.
create policy chat_messages_owner_all
  on public.chat_messages for all
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );

-- reports: owner-only.
create policy reports_owner_all
  on public.reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
