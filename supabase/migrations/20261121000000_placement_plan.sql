-- Annual placement plan (replaces the net profit target, whose column is left in place but no longer read).
alter table public.overview_settings
  add column if not exists plan_annual_placements int not null default 170 check (plan_annual_placements > 0),
  add column if not exists plan_fall_over_pct numeric not null default 30 check (plan_fall_over_pct >= 0 and plan_fall_over_pct < 100),
  add column if not exists plan_year int not null default 2027 check (plan_year between 2026 and 2100);
