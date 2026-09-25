-- Timeliness scoring by calendar day (WIB), not by hour/minute.
-- >= 2 days early = 110; 1 day early = 105; due date = 100;
-- 1 day late = 95; >= 2 days late = 90.

create or replace function private.calculate_timeliness_score(
  p_due_at timestamptz,
  p_submitted_at timestamptz
)
returns numeric
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when p_submitted_at is null then 0::numeric
    when p_due_at is null then 100::numeric
    else greatest(
      90::numeric,
      least(
        110::numeric,
        100::numeric + (
          ((p_due_at at time zone 'Asia/Jakarta')::date
           - (p_submitted_at at time zone 'Asia/Jakarta')::date)::numeric * 5::numeric
        )
      )
    )
  end
$$;

revoke all on function private.calculate_timeliness_score(timestamptz,timestamptz) from public;

-- Recalculate already-evaluated activities so historical/current scores follow the new rule.
update public.task_evaluations te
set
  timeliness_score = calc.timeliness_score,
  score = round(
    (te.complexity_score + calc.timeliness_score + te.quality_score + te.completion_score) / 4.0,
    2
  )
from (
  select
    c.id as claim_id,
    private.calculate_timeliness_score(t.due_at, c.submitted_at) as timeliness_score
  from public.task_claims c
  join public.tasks t on t.id = c.task_id
) calc
where te.claim_id = calc.claim_id;

-- Refresh all leaderboard snapshots to keep averages/ranks consistent.
do $$
declare
  v_period record;
begin
  for v_period in select id from public.weekly_periods loop
    perform private.refresh_leaderboard(v_period.id);
  end loop;
end
$$;
