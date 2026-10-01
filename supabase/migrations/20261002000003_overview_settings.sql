-- Overview tab: net profit target and the current constraint (typed in, not calculated).
-- Accessed only from Vercel functions with the service-role key; RLS on, no policies.
create table if not exists public.overview_settings (
  id                   int primary key default 1 check (id = 1),
  net_profit_target    int not null default 40000 check (net_profit_target > 0),
  constraint_headline  text not null default '',
  constraint_detail    text not null default '',
  confirmed_by         text not null default '',
  confirmed_at         date,
  updated_at           timestamptz not null default now()
);
insert into public.overview_settings (id) values (1) on conflict (id) do nothing;
alter table public.overview_settings enable row level security;
