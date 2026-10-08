import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { complexityLabel } from "@/lib/scoring";

function kpiFor(task: any) {
  return Array.isArray(task.employee_kpis) ? task.employee_kpis[0] : task.employee_kpis;
}

function tupoksiFor(task: any) {
  return Array.isArray(task.employee_tupoksi) ? task.employee_tupoksi[0] : task.employee_tupoksi;
}

export default async function MyWeekPage() {
  const { supabase, profile } = await requireProfile();
  const [employee, period] = await Promise.all([
    getEmployeeForProfile(profile.id, supabase),
    getCurrentPeriod(supabase),
  ]);
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  const taskSelect =
    "id,period_id,title,status,priority,complexity,due_at,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)";

  let tasks: any[] = [];
  if (period) {
    const { data, error } = await supabase
      .from("tasks")
      .select(taskSelect)
      .eq("assigned_to", employee.id)
      .eq("period_id", period.id)
      .order("due_at");
    if (error) throw new Error("Task minggu berjalan gagal dimuat. Silakan coba lagi.");
    tasks = data ?? [];
  }

  return (
    <>
      <PageHeader title="My Week" subtitle={period ? `${period.label} · hanya tugas minggu berjalan` : "Tidak ada periode aktif"} />

      <style>{`
        .myweek-task-link{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--navy2)}
        .myweek-task-link:hover{color:var(--navy);text-decoration:underline}
        .myweek-open-link{display:inline-flex;padding:6px 9px;border-radius:8px;border:1px solid #cfd4ea;color:var(--navy);font-size:11px;font-weight:700;white-space:nowrap}
        .myweek-open-link:hover{background:var(--blue-soft)}
      `}</style>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Support KPI</th>
              <th>Support Tupoksi</th>
              <th>Priority</th>
              <th>Kompleksitas</th>
              <th>Status</th>
              <th>Due</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const kpi = kpiFor(task);
              const tupoksi = tupoksiFor(task);
              const href = `/my-tasks?task=${task.id}`;

              return (
                <tr key={task.id}>
                  <td>
                    <a className="myweek-task-link" href={href}>
                      <span>{task.title}</span>
                    </a>
                  </td>
                  <td>{kpi ? <><strong>{kpi.kpi_code}</strong><div className="muted small">{kpi.kpi_description}</div></> : "-"}</td>
                  <td>{tupoksi ? <><strong>{tupoksi.tupoksi_code}</strong><div className="muted small">{tupoksi.tupoksi_description}</div></> : "-"}</td>
                  <td>{task.priority}</td>
                  <td>{complexityLabel(task.complexity)}</td>
                  <td><StatusBadge status={task.status} /></td>
                  <td>{task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</td>
                  <td><a className="myweek-open-link" href={href}>Buka di My Tasks</a></td>
                </tr>
              );
            })}
            {tasks.length === 0 ? <tr><td colSpan={8} className="empty">{period ? "Belum ada task untuk minggu ini." : "Tidak ada periode aktif saat ini."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
