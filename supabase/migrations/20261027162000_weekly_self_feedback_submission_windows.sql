-- Keep existing weekly_feedback table/RLS intact; adjust only the insertion window.
-- Task submission must have at least one successfully recorded evidence file.
-- Wednesday–Friday: this Monday's week. Monday–Wednesday: previous Monday's week.
-- On Wednesday both periods can be submitted, with the oldest pending prioritized in UI.
create or replace function public.weekly_feedback_guard_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  local_now timestamp;
  weekday integer;
  this_monday date;
begin
  local_now := now() at time zone 'Asia/Jakarta';
  weekday := extract(isodow from local_now)::int;
  this_monday := date_trunc('week', local_now)::date;

  if not (
    (weekday between 3 and 5 and new.week_start = this_monday)
    or (weekday between 1 and 3 and new.week_start = this_monday - 7)
  ) then
    raise exception 'Feedback hanya dapat dikirim Rabu-Jumat minggu berjalan atau Senin-Rabu minggu berikutnya WIB'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.task_claims c
    join public.evidence_files e on e.claim_id = c.id
    where c.employee_id = new.employee_id
      and c.submitted_at >= (new.week_start::timestamp at time zone 'Asia/Jakarta')
      and c.submitted_at < ((new.week_start + 7)::timestamp at time zone 'Asia/Jakarta')
  ) then
    raise exception 'Feedback mensyaratkan minimal satu task yang berhasil disubmit beserta eviden pada minggu terkait'
      using errcode = '23514';
  end if;

  if new.calibration_status <> 'pending' or
     new.calibration_performance is not null or
     new.calibration_contribution is not null or
     new.calibration_collaboration is not null or
     new.calibration_note is not null or
     new.calibrated_by is not null or
     new.calibrated_at is not null then
    raise exception 'Kalibrasi hanya dapat dilakukan oleh atasan';
  end if;
  return new;
end $$;
