-- Activity scoring model: complexity + timeliness + quality + evidence completion

alter table public.tasks
  add column if not exists complexity text not null default 'administrasi';

alter table public.tasks drop constraint if exists tasks_complexity_check;
alter table public.tasks add constraint tasks_complexity_check check (
  complexity in (
    'administrasi',
    'koordinasi_internal_tim',
    'koordinasi_tim_lain',
    'koordinasi_bpo',
    'koordinasi_kantor_pusat'
  )
);

alter table public.task_evaluations
  add column if not exists quality text not null default 'sesuai_arahan',
  add column if not exists complexity_score numeric(5,2) not null default 0,
  add column if not exists timeliness_score numeric(5,2) not null default 0,
  add column if not exists quality_score numeric(5,2) not null default 0,
  add column if not exists completion_score numeric(5,2) not null default 0;

alter table public.task_evaluations drop constraint if exists task_evaluations_quality_check;
alter table public.task_evaluations add constraint task_evaluations_quality_check check (
  quality in ('sesuai_arahan','koreksi_minor','koreksi_mayor')
);

alter table public.task_evaluations drop constraint if exists task_evaluations_score_check;
alter table public.task_evaluations add constraint task_evaluations_score_check check (score >= 0 and score <= 110);

alter table public.leaderboard_weekly
  add column if not exists avg_complexity_score numeric(6,2) not null default 0,
  add column if not exists avg_timeliness_score numeric(6,2) not null default 0,
  add column if not exists avg_quality_score numeric(6,2) not null default 0,
  add column if not exists avg_completion_score numeric(6,2) not null default 0;

create or replace function private.calculate_timeliness_score(p_due_at timestamptz, p_submitted_at timestamptz)
returns numeric
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when p_submitted_at is null then 0::numeric
    when p_due_at is null then 100::numeric
    else round(
      greatest(
        0::numeric,
        least(
          110::numeric,
          100::numeric + (extract(epoch from (p_due_at - p_submitted_at)) / 86400.0) * 5.0
        )
      ),
      2
    )
  end
$$;
revoke all on function private.calculate_timeliness_score(timestamptz,timestamptz) from public;

create or replace function private.score_evaluation_components()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_complexity text;
  v_due_at timestamptz;
  v_submitted_at timestamptz;
  v_complexity_score numeric(5,2);
  v_timeliness_score numeric(5,2);
  v_quality_score numeric(5,2);
  v_completion_score numeric(5,2);
begin
  select t.complexity, t.due_at, c.submitted_at
    into v_complexity, v_due_at, v_submitted_at
  from public.task_claims c
  join public.tasks t on t.id = c.task_id
  where c.id = new.claim_id;

  v_complexity_score := case v_complexity
    when 'administrasi' then 20
    when 'koordinasi_internal_tim' then 40
    when 'koordinasi_tim_lain' then 60
    when 'koordinasi_bpo' then 80
    when 'koordinasi_kantor_pusat' then 100
    else 0
  end;

  v_timeliness_score := private.calculate_timeliness_score(v_due_at, v_submitted_at);

  v_quality_score := case new.quality
    when 'sesuai_arahan' then 100
    when 'koreksi_minor' then 80
    when 'koreksi_mayor' then 60
    else 0
  end;

  v_completion_score := case
    when exists (select 1 from public.evidence_files ef where ef.claim_id = new.claim_id) then 100
    else 0
  end;

  new.complexity_score := v_complexity_score;
  new.timeliness_score := v_timeliness_score;
  new.quality_score := v_quality_score;
  new.completion_score := v_completion_score;
  new.score := round((v_complexity_score + v_timeliness_score + v_quality_score + v_completion_score) / 4.0, 2);
  return new;
end;
$$;
revoke all on function private.score_evaluation_components() from public;

drop trigger if exists trg_evaluation_score_components on public.task_evaluations;
create trigger trg_evaluation_score_components
before insert or update of claim_id, quality
on public.task_evaluations
for each row execute function private.score_evaluation_components();

create or replace function private.refresh_leaderboard(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_period_id is null then return; end if;

  delete from public.leaderboard_weekly where period_id = p_period_id;

  with latest_claim as (
    select distinct on (c.task_id)
      c.id, c.task_id, c.employee_id, c.submitted_at
    from public.task_claims c
    join public.tasks t on t.id = c.task_id
    where t.period_id = p_period_id
    order by c.task_id, c.version desc, c.submitted_at desc
  ),
  task_scores as (
    select
      t.id as task_id,
      t.assigned_to as employee_id,
      t.due_at,
      lc.id as claim_id,
      te.id as evaluation_id,
      te.decision,
      case t.complexity
        when 'administrasi' then 20::numeric
        when 'koordinasi_internal_tim' then 40::numeric
        when 'koordinasi_tim_lain' then 60::numeric
        when 'koordinasi_bpo' then 80::numeric
        when 'koordinasi_kantor_pusat' then 100::numeric
        else 0::numeric
      end as complexity_score,
      private.calculate_timeliness_score(t.due_at, lc.submitted_at) as timeliness_score,
      case te.quality
        when 'sesuai_arahan' then 100::numeric
        when 'koreksi_minor' then 80::numeric
        when 'koreksi_mayor' then 60::numeric
        else 0::numeric
      end as quality_score,
      case when lc.id is not null and exists (
        select 1 from public.evidence_files ef where ef.claim_id = lc.id
      ) then 100::numeric else 0::numeric end as completion_score
    from public.tasks t
    left join latest_claim lc on lc.task_id = t.id
    left join public.task_evaluations te on te.claim_id = lc.id
    where t.period_id = p_period_id
  ),
  scored as (
    select ts.*,
      case when ts.claim_id is null then 0::numeric
      else round((ts.complexity_score + ts.timeliness_score + ts.quality_score + ts.completion_score) / 4.0, 2)
      end as activity_score
    from task_scores ts
  ),
  metrics as (
    select
      e.id as employee_id,
      count(s.task_id)::int as total_assigned,
      count(s.claim_id)::int as total_submitted,
      count(s.evaluation_id) filter (where s.decision = 'approved')::int as total_approved,
      count(s.task_id) filter (where s.due_at is not null and s.due_at < now() and coalesce(s.decision, '') <> 'approved')::int as overdue_count,
      coalesce(round(avg(s.activity_score), 2), 0)::numeric(6,2) as avg_score,
      coalesce(round(avg(s.timeliness_score), 2), 0)::numeric(6,2) as on_time_rate,
      coalesce(round(avg(s.completion_score), 2), 0)::numeric(6,2) as completion_rate,
      coalesce(round(avg(s.complexity_score), 2), 0)::numeric(6,2) as avg_complexity_score,
      coalesce(round(avg(s.timeliness_score), 2), 0)::numeric(6,2) as avg_timeliness_score,
      coalesce(round(avg(s.quality_score), 2), 0)::numeric(6,2) as avg_quality_score,
      coalesce(round(avg(s.completion_score), 2), 0)::numeric(6,2) as avg_completion_score
    from public.employees e
    left join scored s on s.employee_id = e.id
    where e.active = true
    group by e.id
  ),
  ranked as (
    select m.*,
      dense_rank() over (order by m.avg_score desc, m.avg_quality_score desc, m.avg_timeliness_score desc, m.avg_completion_score desc)::int as rank
    from metrics m
  )
  insert into public.leaderboard_weekly (
    period_id, employee_id, total_assigned, total_submitted, total_approved,
    overdue_count, avg_score, on_time_rate, completion_rate, weighted_points, rank, refreshed_at,
    avg_complexity_score, avg_timeliness_score, avg_quality_score, avg_completion_score
  )
  select
    p_period_id, employee_id, total_assigned, total_submitted, total_approved,
    overdue_count, avg_score, on_time_rate, completion_rate, avg_score, rank, now(),
    avg_complexity_score, avg_timeliness_score, avg_quality_score, avg_completion_score
  from ranked;
end;
$$;

create or replace function private.trg_refresh_leaderboard_from_evidence()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_period uuid;
  v_claim uuid;
begin
  v_claim := coalesce(new.claim_id, old.claim_id);
  select t.period_id into v_period
  from public.task_claims c
  join public.tasks t on t.id = c.task_id
  where c.id = v_claim;
  perform private.refresh_leaderboard(v_period);
  return coalesce(new, old);
end;
$$;
revoke all on function private.trg_refresh_leaderboard_from_evidence() from public;

drop trigger if exists trg_evidence_refresh_leaderboard on public.evidence_files;
create trigger trg_evidence_refresh_leaderboard
after insert or update or delete
on public.evidence_files
for each row execute function private.trg_refresh_leaderboard_from_evidence();

create or replace function private.audit_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.activity_log(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'evaluation.created' else 'evaluation.updated' end,
    'task_evaluation',
    new.id,
    jsonb_build_object(
      'claim_id', new.claim_id,
      'decision', new.decision,
      'quality', new.quality,
      'score', new.score,
      'complexity_score', new.complexity_score,
      'timeliness_score', new.timeliness_score,
      'quality_score', new.quality_score,
      'completion_score', new.completion_score
    )
  );
  return new;
end;
$$;
