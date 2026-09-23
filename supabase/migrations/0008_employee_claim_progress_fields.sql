alter table public.task_claims
  add column if not exists progress_status text not null default 'selesai',
  add column if not exists employee_comment text;

alter table public.task_claims drop constraint if exists task_claims_progress_status_check;
alter table public.task_claims add constraint task_claims_progress_status_check
  check (progress_status in ('selesai','lanjut_pekan_depan'));

alter table public.task_claims drop constraint if exists task_claims_completion_percent_check;
alter table public.task_claims add constraint task_claims_completion_percent_check
  check (completion_percent >= 0 and completion_percent <= 100);
