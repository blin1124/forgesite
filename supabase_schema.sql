create table if not exists public.entitlements (
  id bigserial primary key,
  email text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text check (status in ('active','past_due','canceled','incomplete','trialing')),
  current_period_end timestamptz,
  updated_at timestamptz default now()
);
create index if not exists entitlements_email_idx on public.entitlements (email);
alter table public.entitlements enable row level security;



-- Team seats
alter table public.entitlements
  add column if not exists team_id uuid default gen_random_uuid(),
  add column if not exists role text check (role in ('owner','member')) default 'owner';

create table if not exists public.team_invites (
  id bigserial primary key,
  team_id uuid not null,
  inviter_email text not null,
  invitee_email text not null,
  status text check (status in ('pending','accepted','revoked')) default 'pending',
  created_at timestamptz default now()
);

create index if not exists team_invites_invitee_idx on public.team_invites (invitee_email);
create index if not exists team_invites_team_idx on public.team_invites (team_id);


-- Email invite tokens + expiry
alter table public.team_invites
  add column if not exists token uuid default gen_random_uuid(),
  add column if not exists expires_at timestamptz default (now() + interval '7 days');

-- Store seat subscription item id for metered billing
alter table public.entitlements
  add column if not exists stripe_seat_item_id text;
