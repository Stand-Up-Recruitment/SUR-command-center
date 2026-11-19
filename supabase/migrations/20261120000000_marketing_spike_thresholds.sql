-- Marketing tab: Brinda's ad set spike rule, editable in Edit targets.
-- Last 3 days' cost per result vs the ad set's own 14-day normal:
-- SPIKE at spike_pct+ above, WATCH at watch_pct+ above, STRONG at watch_pct+ below;
-- ad sets under spike_min_spend in 3 days are ignored.
alter table public.marketing_settings
  add column if not exists spike_pct       numeric not null default 50 check (spike_pct > 0),
  add column if not exists watch_pct       numeric not null default 20 check (watch_pct > 0),
  add column if not exists spike_min_spend numeric not null default 50 check (spike_min_spend >= 0),
  add constraint marketing_settings_watch_below_spike check (watch_pct < spike_pct);
