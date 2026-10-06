import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { complexityLabel } from "@/lib/scoring";

const CARRY_OVER_STATUSES = ["assigned", "in_progress", "submitted", "revision"];

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

  let currentTasks: any[] = [];
  let carryOverTasks: any[] = [];

  if (period) {
    const [currentResult, previousPeriodsResult] = await Promise.all([
      supabase
        .from("tasks")
        .select(taskSelect)
        .eq("assigned_to", employee.id)
        .eq("period_id", period.id)
        .order("due_at"),
      supabase
        .from("weekly_periods")
        .select("id")
        .lt("week_start", period.week_start)
        .order("week_start", { ascending: false }),
    ]);

    currentTasks = currentResult.data ?? [];
    const previousPeriodIds = (previousPeriodsResult.data ?? []).map((item) => item.id);

    if (previousPeriodIds.length > 0) {
      const { data } = await supabase
        .from("tasks")
        .select(taskSelect)
        .eq("assigned_to", employee.id)
        .in("period_id", previousPeriodIds)
        .in("status", CARRY_OVER_STATUSES)
        .order("due_at", { ascending: true });
      carryOverTasks = data ?? [];
    }
  } else {
    const { data } = await supabase
      .from("tasks")
      .select(taskSelect)
      .eq("assigned_to", employee.id)
      .in("status", CARRY_OVER_STATUSES)
      .order("due_at", { ascending: true });
    carryOverTasks = data ?? [];
  }

  const tasks = [...carryOverTasks, ...currentTasks];

  return (
    <>
      <PageHeader title="My Week" subtitle={period?.label || "Periode aktif"} />
      {carryOverTasks.length > 0 ? (
        <div className="notice warning">
          Ada {carryOverTasks.length} task carry over dari periode sebelumnya yang belum closed / masih membutuhkan tindak lanjut. Deadline asli tetap mengikuti periode sebelumnya.
        </div>
      ) : null}

      <style>{`
        .myweek-task-link{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--navy2)}
        .myweek-task-link:hover{color:var(--navy);text-decoration:underline}
        .carryover-tag{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#fffaeb;color:#b54708;font-size:10px;font-weight:800;white-space:nowrap}
        .myweek-open-link{display:inline-flex;padding:6px 9px;border-radius:8px;border:1px solid #cfd4ea;color:var(--navy);font-size:11px;font-weight:700;white-space:nowrap}
        .myweek-open-link:hover{background:var(--blue-soft)}
        .myweek-carryover-row{background:#fffdf7}
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
              const isCarryOver = Boolean(period && task.period_id !== period.id);
              const href = `/my-tasks?task=${task.id}`;

              return (
                <tr key={task.id} className={isCarryOver ? "myweek-carryover-row" : undefined}>
                  <td>
                    <a className="myweek-task-link" href={href}>
                      <span>{task.title}</span>
                      {isCarryOver ? <span className="carryover-tag">Carry Over</span> : null}
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
            {tasks.length === 0 ? <tr><td colSpan={8} className="empty">Belum ada task untuk minggu ini atau carry over.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
