-- Standalone weekly feedback; deliberately no triggers or FKs to scoring/leaderboard.
create table if not exists public.weekly_feedback (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  week_start date not null,
  performance smallint not null check (performance between 1 and 5),
  contribution smallint not null check (contribution between 1 and 5),
  collaboration smallint not null check (collaboration between 1 and 5),
  created_at timestamptz not null default now(),
  calibration_status text not null default 'pending' check (calibration_status in ('pending','calibrated','insufficient')),
  calibration_performance smallint check (calibration_performance between 1 and 5),
  calibration_contribution smallint check (calibration_contribution between 1 and 5),
  calibration_collaboration smallint check (calibration_collaboration between 1 and 5),
  calibration_note text,
  calibrated_by uuid references public.profiles(id),
  calibrated_at timestamptz,
  constraint weekly_feedback_one_per_week unique (employee_id, week_start),
  constraint weekly_feedback_complete_calibration check (
    calibration_status <> 'calibrated'
    or (calibration_performance is not null and calibration_contribution is not null and calibration_collaboration is not null and calibrated_by is not null and calibrated_at is not null)
  )
);
create index if not exists weekly_feedback_week_idx on public.weekly_feedback(week_start desc, created_at desc);
create index if not exists weekly_feedback_employee_idx on public.weekly_feedback(employee_id, created_at desc);
alter table public.weekly_feedback enable row level security;
-- Restrict access to individual operations and columns, never rely on RLS alone.
revoke all on public.weekly_feedback from public, anon, authenticated;
grant select on public.weekly_feedback to authenticated;
grant insert (employee_id,week_start,performance,contribution,collaboration) on public.weekly_feedback to authenticated;
grant update (calibration_status,calibration_performance,calibration_contribution,calibration_collaboration,calibration_note,calibrated_by,calibrated_at) on public.weekly_feedback to authenticated;
create policy "weekly_feedback_owner_read" on public.weekly_feedback for select to authenticated
using (exists (select 1 from public.employees e where e.id=employee_id and e.profile_id=(select auth.uid()) and e.active));
create policy "weekly_feedback_supervisor_read" on public.weekly_feedback for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('supervisor','admin')));
create policy "weekly_feedback_owner_insert" on public.weekly_feedback for insert to authenticated
with check (
  exists (select 1 from public.employees e where e.id=employee_id and e.profile_id=(select auth.uid()) and e.active)
);
create policy "weekly_feedback_supervisor_calibrate" on public.weekly_feedback for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('supervisor','admin')))
with check (
  calibrated_by=(select auth.uid()) and
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('supervisor','admin'))
);
-- Browser requests cannot forge a different week or submit on another weekday.
create or replace function public.weekly_feedback_guard_insert()
returns trigger language plpgsql security invoker set search_path=public as $$
declare local_now timestamp; expected_monday date;
begin
  local_now := now() at time zone 'Asia/Jakarta';
  expected_monday := date_trunc('week',local_now)::date;
  if extract(isodow from local_now) not in (4,5) then
    raise exception 'Pengisian feedback hanya dibuka Kamis dan Jumat WIB';
  end if;
  if new.week_start <> expected_monday then
    raise exception 'Periode feedback harus minggu berjalan WIB';
  end if;
  if new.calibration_status <> 'pending' or new.calibration_performance is not null or
     new.calibration_contribution is not null or new.calibration_collaboration is not null or
     new.calibration_note is not null or new.calibrated_by is not null or new.calibrated_at is not null then
    raise exception 'Kalibrasi hanya dapat dilakukan oleh atasan';
  end if;
  return new;
end $$;
drop trigger if exists trg_weekly_feedback_guard_insert on public.weekly_feedback;
create trigger trg_weekly_feedback_guard_insert before insert on public.weekly_feedback
for each row execute function public.weekly_feedback_guard_insert();
