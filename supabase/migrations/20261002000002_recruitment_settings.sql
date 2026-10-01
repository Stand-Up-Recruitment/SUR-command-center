-- Recruitment tab: editable capacity settings + recruiter list (headcount and start dates).
-- Accessed only from Vercel functions with the service-role key; RLS on, no policies.
create table if not exists public.recruitment_settings (
  id               int primary key default 1 check (id = 1),
  max_active_jobs  int not null default 7 check (max_active_jobs > 0),
  ramp_weeks       int not null default 4 check (ramp_weeks >= 0),
  buffer_weeks     int not null default 2 check (buffer_weeks >= 0),
  recruiters       jsonb not null default '[
    {"name": "Ayn", "startDate": null},
    {"name": "Ian", "startDate": null},
    {"name": "Kade", "startDate": null},
    {"name": "Lionel", "startDate": null}
  ]'::jsonb,
  updated_at       timestamptz not null default now()
);
insert into public.recruitment_settings (id) values (1) on conflict (id) do nothing;
alter table public.recruitment_settings enable row level security;
