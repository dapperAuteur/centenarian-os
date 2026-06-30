-- Maps a WitUS account (OIDC `sub` from accounts.witus.online) to a CentenarianOS
-- Supabase user. The "Sign in with WitUS" callback links by email on first login,
-- then by this row thereafter. Only the server (service role) reads/writes it.
create table if not exists public.witus_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  witus_sub text not null unique,
  created_at timestamptz not null default now()
);

-- RLS on with no policies => only the service-role server bypasses it. No client
-- ever needs to read this table directly.
alter table public.witus_identities enable row level security;
