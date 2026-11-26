-- Sales tab v2: editable close-rate target (% of meetings had that sign a ToB).
alter table public.sales_settings
  add column if not exists close_rate_target numeric not null default 30 check (close_rate_target > 0 and close_rate_target <= 100);
