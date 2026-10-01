-- Marketing tab: monthly targets (null = not set; cards fall back to last month) and
-- the editable list of non-trade candidate categories (null = use the code default).
alter table public.marketing_settings
  add column if not exists target_calls_booked                 numeric check (target_calls_booked >= 0),
  add column if not exists target_qualified_candidates         numeric check (target_qualified_candidates >= 0),
  add column if not exists target_cost_per_booked_call         numeric check (target_cost_per_booked_call >= 0),
  add column if not exists target_cost_per_qualified_candidate numeric check (target_cost_per_qualified_candidate >= 0),
  add column if not exists non_trade_categories                text[];
