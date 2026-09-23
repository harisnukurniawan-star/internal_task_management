create table if not exists public.employee_kpis (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kpi_code text not null,
  kpi_description text not null,
  achievement numeric null,
  period_label text not null default '2026-1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, kpi_code),
  unique(employee_id, id)
);

alter table public.employee_kpis enable row level security;
revoke all on table public.employee_kpis from anon, authenticated;
grant select on table public.employee_kpis to authenticated;

drop policy if exists employee_kpis_select_supervisor_or_self on public.employee_kpis;
create policy employee_kpis_select_supervisor_or_self
on public.employee_kpis for select
to authenticated
using (
  private.is_supervisor()
  or exists (
    select 1 from public.employees e
    where e.id = employee_kpis.employee_id
      and e.profile_id = (select auth.uid())
      and e.active = true
  )
);

alter table public.tasks add column if not exists support_kpi_id uuid null;
alter table public.tasks drop constraint if exists tasks_support_kpi_employee_fkey;
alter table public.tasks
  add constraint tasks_support_kpi_employee_fkey
  foreign key (assigned_to, support_kpi_id)
  references public.employee_kpis(employee_id, id)
  on update restrict on delete restrict;

create index if not exists idx_employee_kpis_employee_active on public.employee_kpis(employee_id, active);
create index if not exists idx_tasks_support_kpi on public.tasks(support_kpi_id);

insert into public.employee_kpis(employee_id,kpi_code,kpi_description,achievement,period_label,active)
select e.id, v.kpi_code, v.kpi_description, v.achievement, '2026-1', true
from public.employees e
join (values
  ('Citra Aries','KP.HCBPAR.PNP1.1.1.1','Laporan Pelaksanaan Kunjungan Stakeholder Engagement',100::numeric),
  ('Citra Aries','KP.HCBPAR.PNP24.1.1','Ketersediaan Data Pemenuhan Dokumen PLN Business Excellent',100::numeric),
  ('Citra Aries','KP.HCBPAR.PNP25.1.1.1','Ketersediaan Data Pemenuhan Dokumen Kepatuhan (HSSE, Penyelesaian Temuan Audit, Akurasi Data Kinerja, Pengendalian NAC, Critical Event, Kearsipan)',100::numeric),
  ('Heri Syamsudin','KP.HCBPAR.PNP25.1.1.1','Ketersediaan Data Pemenuhan Dokumen Kepatuhan (HSSE, Penyelesaian Temuan Audit, Akurasi Data Kinerja, Pengendalian NAC, Critical Event, Kearsipan)',100::numeric),
  ('Heri Syamsudin','KP.HCBPAR.PNP26.1.1','Ketersediaan Data Pemenuhan Dokumen Risiko',100::numeric),
  ('Heri Syamsudin','KP.HCBPAR.PNP5.1.1.1','Ketersediaan Data Pendukung Penyusunan Dokumen Kajian Optimasi Produktivitas Pegawai',100::numeric),
  ('Endang Mirah Ayu','KP.HCBPAR.PNP25.1.1.1','Ketersediaan Data Pemenuhan Dokumen Kepatuhan (HSSE, Penyelesaian Temuan Audit, Akurasi Data Kinerja, Pengendalian NAC, Critical Event, Kearsipan)',100::numeric),
  ('Endang Mirah Ayu','KP.HCBPAR.PNP5.1.1.1','Ketersediaan Data Pendukung Penyusunan Dokumen Kajian Optimasi Produktivitas Pegawai',100::numeric),
  ('Endang Mirah Ayu','KP.HCBPAR.PNP9.1.1.1','Laporan Perencanaan/Penyusunan Program Budaya Perusahaan',110::numeric)
) as v(full_name,kpi_code,kpi_description,achievement)
  on e.full_name = v.full_name
on conflict (employee_id,kpi_code) do update
set kpi_description = excluded.kpi_description,
    achievement = excluded.achievement,
    period_label = excluded.period_label,
    active = true,
    updated_at = now();
