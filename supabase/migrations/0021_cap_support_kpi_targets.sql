-- Normalize all existing Support KPI targets to 100% and prevent values above 100.
update public.employee_kpis
set achievement = 100,
    updated_at = now()
where achievement is distinct from 100;

alter table public.employee_kpis
  drop constraint if exists employee_kpis_achievement_max_100;

alter table public.employee_kpis
  add constraint employee_kpis_achievement_max_100
  check (achievement is null or (achievement >= 0 and achievement <= 100));
