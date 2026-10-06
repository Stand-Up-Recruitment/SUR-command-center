-- Retention tab: status thresholds on fall-over rate (interim, until Les sets targets) and the
-- before/after Rachel cut-off for the cohort table.
-- Accessed only from Vercel functions with the service-role key; RLS on, no policies.
create table if not exists public.retention_settings (
  id             int primary key default 1 check (id = 1),
  green_below    numeric not null default 5 check (green_below >= 0),
  amber_below    numeric not null default 10 check (amber_below >= 0),
  rachel_cutoff  date not null default '2026-09-01',
  updated_at     timestamptz not null default now()
);
insert into public.retention_settings (id) values (1) on conflict (id) do nothing;
alter table public.retention_settings enable row level security;
