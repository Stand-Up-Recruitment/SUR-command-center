-- Marketing tab: editable settings + month-end follower snapshots.
-- Accessed only from Vercel functions with the service-role key; RLS on, no policies.
create table if not exists public.marketing_settings (
  id              int primary key default 1 check (id = 1),
  monthly_budget  numeric,
  posts_per_week  int not null default 7 check (posts_per_week > 0),
  updated_at      timestamptz not null default now()
);
insert into public.marketing_settings (id) values (1) on conflict (id) do nothing;
alter table public.marketing_settings enable row level security;

create table if not exists public.follower_snapshots (
  channel    text not null check (channel in ('instagram', 'facebook', 'les')),
  month      text not null check (month ~ '^\d{4}-\d{2}$'),
  followers  int  not null,
  taken_at   timestamptz not null default now(),
  primary key (channel, month)
);
alter table public.follower_snapshots enable row level security;

-- Seed: Stand Up Instagram follower total on 30 Sep 2026 (answer key), so net change
-- shows from 31 Oct even though the Page token isn't connected for tonight's cron run.
insert into public.follower_snapshots (channel, month, followers, taken_at)
values ('instagram', '2026-09', 3636, '2026-09-30T10:59:00Z')
on conflict (channel, month) do nothing;
