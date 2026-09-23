create table if not exists public.employee_tupoksi (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  tupoksi_code text not null,
  tupoksi_description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, tupoksi_code),
  unique(employee_id, id)
);

alter table public.employee_tupoksi enable row level security;
revoke all on table public.employee_tupoksi from anon, authenticated;
grant select on table public.employee_tupoksi to authenticated;

drop policy if exists employee_tupoksi_select_supervisor_or_self on public.employee_tupoksi;
create policy employee_tupoksi_select_supervisor_or_self
on public.employee_tupoksi for select
to authenticated
using (
  private.is_supervisor()
  or exists (
    select 1 from public.employees e
    where e.id = employee_tupoksi.employee_id
      and e.profile_id = (select auth.uid())
      and e.active = true
  )
);

alter table public.tasks add column if not exists support_tupoksi_id uuid null;
alter table public.tasks drop constraint if exists tasks_support_tupoksi_employee_fkey;
alter table public.tasks
  add constraint tasks_support_tupoksi_employee_fkey
  foreign key (assigned_to, support_tupoksi_id)
  references public.employee_tupoksi(employee_id, id)
  on update restrict on delete restrict;

create index if not exists idx_employee_tupoksi_employee_active on public.employee_tupoksi(employee_id, active);
create index if not exists idx_tasks_support_tupoksi on public.tasks(support_tupoksi_id);

with items(tupoksi_code, tupoksi_description, target_name) as (
  values
    ('T01','Identifikasi Strategi dan Isu Bisnis dengan BPO','Citra Aries'),
    ('T02','Analisis Proses Bisnis, Struktur Organisasi, Kebutuhan Tenaga Kerja dan Kebutuhan Kompetensi','ALL'),
    ('T03','Eksekusi HC Roadmap dan Strategi HC pendukung Strategi BPO','ALL'),
    ('T04','Sosialisasi dan Liasson Officer terkait Peraturan Human Capital','Citra Aries'),
    ('T05','Change Management HC (Budaya)','Endang Mirah Ayu'),
    ('T06','Monitoring Realisasi Anggaran 52 Unit','Endang Mirah Ayu'),
    ('T07','Monitoring Realisasi Anggaran HCBP','Endang Mirah Ayu'),
    ('T08','Monitoring Kinerja dan pelaporan kinerja','Heri Syamsudin'),
    ('T08','Monitoring Kinerja dan pelaporan kinerja','Citra Aries')
)
insert into public.employee_tupoksi(employee_id, tupoksi_code, tupoksi_description)
select e.id, i.tupoksi_code, i.tupoksi_description
from public.employees e
join items i on i.target_name = 'ALL' or i.target_name = e.full_name
where e.full_name in ('Citra Aries','Heri Syamsudin','Endang Mirah Ayu')
on conflict (employee_id, tupoksi_code) do update
set tupoksi_description = excluded.tupoksi_description,
    active = true,
    updated_at = now();
