import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { complexityLabel } from "@/lib/scoring";

function kpiFor(task: any) {
  return Array.isArray(task.employee_kpis) ? task.employee_kpis[0] : task.employee_kpis;
}

export default async function MyWeekPage() {
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  const period = await getCurrentPeriod();
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  let query = supabase
    .from("tasks")
    .select("id,title,status,priority,complexity,due_at,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description)")
    .eq("assigned_to", employee.id);
  if (period) query = query.eq("period_id", period.id);
  const { data: taskRows } = await query.order("due_at");
  const tasks = taskRows ?? [];

  return (
    <>
      <PageHeader title="My Week" subtitle={period?.label || "Periode aktif"}/>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Task</th><th>Support KPI</th><th>Priority</th><th>Kompleksitas</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>
            {tasks.map((task) => {
              const kpi = kpiFor(task);
              return <tr key={task.id}><td>{task.title}</td><td>{kpi ? <><strong>{kpi.kpi_code}</strong><div className="muted small">{kpi.kpi_description}</div></> : "-"}</td><td>{task.priority}</td><td>{complexityLabel(task.complexity)}</td><td><StatusBadge status={task.status}/></td><td>{task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</td></tr>;
            })}
            {tasks.length === 0 ? <tr><td colSpan={6} className="empty">Belum ada task untuk minggu ini.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
