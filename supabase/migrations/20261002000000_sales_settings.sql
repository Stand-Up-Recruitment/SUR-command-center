-- Sales tab: editable signings target.
-- Accessed only from Vercel functions with the service-role key; RLS on, no policies.
create table if not exists public.sales_settings (
  id                      int primary key default 1 check (id = 1),
  target_per_salesperson  int not null default 10 check (target_per_salesperson > 0),
  updated_at              timestamptz not null default now()
);
insert into public.sales_settings (id) values (1) on conflict (id) do nothing;
alter table public.sales_settings enable row level security;
