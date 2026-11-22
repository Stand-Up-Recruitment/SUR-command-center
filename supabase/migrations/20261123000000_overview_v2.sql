-- Overview v2: constraint owner + "fixed when" target, and the runway line for the 3-month cash status.
alter table public.overview_settings
  add column if not exists constraint_owner text not null default '',
  add column if not exists constraint_fixed_when text not null default '',
  add column if not exists runway_weeks_min numeric not null default 8 check (runway_weeks_min >= 0);
