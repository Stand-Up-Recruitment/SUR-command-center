-- Retention thresholds are inclusive maximums: fall-over rate ≤ 20% green, ≤ 30% amber, else red.
alter table public.retention_settings rename column green_below to green_max;
alter table public.retention_settings rename column amber_below to amber_max;
alter table public.retention_settings alter column green_max set default 20;
alter table public.retention_settings alter column amber_max set default 30;
update public.retention_settings set green_max = 20, amber_max = 30, updated_at = now() where id = 1;
