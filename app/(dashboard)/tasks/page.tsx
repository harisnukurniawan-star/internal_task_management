import Link from "next/link";
import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";
import { COMPLEXITY_OPTIONS, complexityLabel } from "@/lib/scoring";
import { createTaskWithKpi, updateTask } from "./actions";
import { TaskActionMenu } from "./task-action-menu";
import { TaskIdentityFields } from "./support-kpi-fields";

type TaskSearchParams = FlashParams & { edit?: string; tab?: string; page?: string };

const OPEN_TASK_STATUSES = ["assigned", "in_progress", "submitted", "revision"];

function kpiFor(task: any) {
  return Array.isArray(task.employee_kpis) ? task.employee_kpis[0] : task.employee_kpis;
}

function tupoksiFor(task: any) {
  return Array.isArray(task.employee_tupoksi) ? task.employee_tupoksi[0] : task.employee_tupoksi;
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskSearchParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) return <p>Unauthorized</p>;

  const activeTab = params.edit ? "list" : params.tab === "assign" ? "assign" : "list";
  const needsIdentityData = activeTab === "assign" || Boolean(params.edit);

  const identityPromise = needsIdentityData
    ? Promise.all([
        supabase.from("employees").select("id,full_name").eq("active", true).order("display_order"),
        supabase.from("employee_kpis").select("id,employee_id,kpi_code,kpi_description,achievement").eq("active", true).order("kpi_code"),
        supabase.from("employee_tupoksi").select("id,employee_id,tupoksi_code,tupoksi_description").eq("active", true).order("tupoksi_code"),
      ])
    : Promise.resolve(null);

  const [period, identityResults] = await Promise.all([
    getCurrentPeriod(supabase),
    identityPromise,
  ]);

  const employees = identityResults?.[0].data ?? [];
  const kpis = identityResults?.[1].data ?? [];
  const tupoksi = identityResults?.[2].data ?? [];

  let tasks: any[] = [];
  const submittedTaskIds = new Set<string>();
  const periodLabels = new Map<string, string>();

  if (activeTab === "list") {
    const taskSelect = "id,period_id,title,description,status,priority,complexity,due_at,assigned_to,support_kpi_id,support_tupoksi_id,created_at,employees!tasks_assigned_to_fkey(full_name),employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description,achievement),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)";

    const [currentResult, openResult] = await Promise.all([
      period
        ? supabase
            .from("tasks")
            .select(taskSelect)
            .eq("period_id", period.id)
            .in("status", OPEN_TASK_STATUSES)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("tasks")
        .select(taskSelect)
        .in("status", OPEN_TASK_STATUSES)
        .order("due_at", { ascending: true }),
    ]);

    const taskMap = new Map<string, any>();
    for (const task of openResult.data ?? []) taskMap.set(task.id, task);
    for (const task of currentResult.data ?? []) taskMap.set(task.id, task);

    tasks = Array.from(taskMap.values()).sort((a, b) => {
      const aCarry = period ? a.period_id !== period.id : true;
      const bCarry = period ? b.period_id !== period.id : true;
      if (aCarry !== bCarry) return aCarry ? -1 : 1;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const taskIds = tasks.map((task) => task.id);
    const periodIds = [...new Set(tasks.map((task) => task.period_id).filter(Boolean))];

    const [claimResult, periodResult] = await Promise.all([
      taskIds.length > 0
        ? supabase.from("task_claims").select("task_id").in("task_id", taskIds)
        : Promise.resolve({ data: [] as any[] }),
      periodIds.length > 0
        ? supabase.from("weekly_periods").select("id,label").in("id", periodIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    for (const claim of claimResult.data ?? []) submittedTaskIds.add(claim.task_id);
    for (const item of periodResult.data ?? []) periodLabels.set(item.id, item.label);
  }

  const editTask = params.edit
    ? tasks.find((task) => task.id === params.edit && (!period || task.period_id === period.id))
    : null;
  const carryOverCount = period
    ? tasks.filter((task) => task.period_id !== period.id && OPEN_TASK_STATUSES.includes(task.status)).length
    : tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status)).length;

  const pageSize = editTask ? 3 : 6;
  const requestedPage = Number.parseInt(params.page || "1", 10);
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const visibleTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={activeTab === "list" ? "teamtasks-page teamtasks-list-fit" : "teamtasks-page teamtasks-assign-fit"}>
      <style>{`
        .teamtasks-list-fit{height:calc(100vh - 44px);min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:7px}
        .teamtasks-list-fit .topbar{margin-bottom:2px;flex:0 0 auto}
        .teamtasks-list-fit .page-tabs{margin:0;flex:0 0 auto}
        .teamtasks-list-fit .notice{margin:0;padding:6px 9px;line-height:1.25;flex:0 0 auto}
        .teamtasks-list-panel{display:flex;flex-direction:column;gap:7px;min-height:0;flex:1 1 auto}
        .teamtasks-table-wrap{overflow:visible!important;min-height:0;flex:1 1 auto;border-radius:11px}
        .teamtasks-table{table-layout:fixed;width:100%}
        .teamtasks-table th,.teamtasks-table td{padding:7px 8px;font-size:11px;line-height:1.2;vertical-align:middle;overflow:hidden}
        .teamtasks-table th{height:32px}
        .teamtasks-table tbody tr{height:52px}
        .teamtasks-table td{max-height:52px}
        .teamtasks-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-word}
        .teamtasks-clamp.one{-webkit-line-clamp:1}
        .teamtasks-title{font-size:11px;line-height:1.2}
        .teamtasks-carry{display:inline-flex;margin-left:5px;padding:2px 5px;border-radius:999px;background:#fffaeb;color:#b54708;font-size:9px;font-weight:800;vertical-align:middle}
        .teamtasks-table .badge{font-size:9px;padding:3px 6px;white-space:nowrap}
        .teamtasks-table .btn{font-size:10px;padding:5px 7px;white-space:nowrap}
        .teamtasks-table td.teamtasks-action-cell{overflow:visible!important}
        .teamtasks-pagination{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;position:relative;z-index:80;background:#fff;padding:2px 0 1px}
        .teamtasks-pagination .btn{padding:6px 9px;font-size:11px;pointer-events:auto}
        .teamtasks-page .flash-message{margin:0}
        .teamtasks-assign-fit{height:calc(100vh - 44px);min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:7px}
        .teamtasks-assign-fit .topbar{margin-bottom:2px;flex:0 0 auto}
        /* Keep Team Tasks header dimensions identical between Assign Task and Daftar Task. */
        .teamtasks-assign-fit .page-tabs{margin:0;flex:0 0 auto}
        .teamtasks-assign-fit .tab-panel{flex:1 1 auto;min-height:0;overflow:hidden}
        .teamtasks-assign-fit .card.compact{padding:10px 12px;display:flex;flex-direction:column}
        .teamtasks-assign-fit .card h3{margin:0 0 7px;font-size:15px;line-height:1.1}
        .teamtasks-assign-fit .form{gap:6px;min-height:0;flex:1 1 auto}
        .teamtasks-assign-fit .form-row{gap:8px}
        .teamtasks-assign-fit .field{gap:3px}
        .teamtasks-assign-fit .field label{font-size:11px;line-height:1.15}
        .teamtasks-assign-fit .field input,.teamtasks-assign-fit .field textarea,.teamtasks-assign-fit .field select{padding:6px 8px;font-size:12px;border-radius:8px}
        .teamtasks-assign-fit .field textarea{min-height:58px;max-height:58px;resize:none}
        .teamtasks-assign-fit .field small{font-size:10px;line-height:1.15}
        .teamtasks-assign-fit .btn{padding:7px 10px;font-size:12px}
        @supports selector(:has(*)){
          .main:has(.teamtasks-assign-fit){height:100vh;overflow:hidden;padding-top:22px;padding-bottom:22px}
          .main:has(.teamtasks-assign-fit) .teamtasks-assign-fit{height:calc(100vh - 44px)}
        }
        @media(max-width:1100px){
          .teamtasks-table th,.teamtasks-table td{padding:6px 6px;font-size:10px}
          .teamtasks-table tbody tr{height:48px}
          .teamtasks-table td{max-height:48px}
        }
        @media(max-width:900px){
          .main:has(.teamtasks-assign-fit){height:auto;overflow:visible;padding-top:14px;padding-bottom:14px}
          .teamtasks-assign-fit,.main:has(.teamtasks-assign-fit) .teamtasks-assign-fit{height:auto;overflow:visible}
          .teamtasks-assign-fit .tab-panel{overflow:visible}
          .teamtasks-assign-fit .field textarea{min-height:82px;max-height:none;resize:vertical}
        }
      `}</style>
      <PageHeader title="Team Tasks" subtitle={period ? `${period.label} · task minggu berjalan + seluruh task bawahan yang masih open dari periode sebelumnya.` : "Menampilkan seluruh task bawahan yang masih open."} />
      <FlashMessage params={params} />

      <nav className="page-tabs" aria-label="Team task sections">
        <Link prefetch className={`page-tab ${activeTab === "assign" ? "active" : ""}`} href="/tasks?tab=assign">Assign Task</Link>
        <Link prefetch className={`page-tab ${activeTab === "list" ? "active" : ""}`} href="/tasks?tab=list">Daftar Task</Link>
      </nav>

      {activeTab === "assign" ? (
        period ? (
          <section className="card compact tab-panel">
            <h3>Assign task</h3>
            <form action={createTaskWithKpi} className="form">
              <input type="hidden" name="period_id" value={period.id} />
              <TaskIdentityFields employees={employees} kpis={kpis} tupoksi={tupoksi} />
              <div className="form-row three">
                <div className="field">
                  <label>Priority</label>
                  <select name="priority" defaultValue="medium">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <div className="field">
                  <label>Kompleksitas</label>
                  <select name="complexity" defaultValue="administrasi">
                    {COMPLEXITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>Due date</label><input name="due_date" type="date" /></div>
              </div>
              <button className="btn" type="submit">Assign Task</button>
            </form>
          </section>
        ) : <div className="notice warning tab-panel">Periode aktif belum tersedia sehingga task belum dapat di-assign.</div>
      ) : (
        <div className="tab-panel teamtasks-list-panel">
          {params.edit && !editTask ? <div className="notice warning">Task carry over hanya untuk monitoring/validasi. Edit task tetap dibatasi pada periode aktif.</div> : null}
          {carryOverCount > 0 ? (
            <div className="notice warning">
              Ada {carryOverCount} task carry over dari periode sebelumnya yang masih open / belum selesai divalidasi. Deadline dan periode asal tetap dipertahankan.
            </div>
          ) : null}

          {editTask ? (
            <section className="card compact" id="edit-task">
              <div className="card-head">
                <div>
                  <h3>Edit task</h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    Task dapat diedit selama minggu berjalan.
                    {submittedTaskIds.has(editTask.id) ? " Karena sudah ada submission, Employee tetap dikunci tetapi Support KPI dan Support Tupoksi masih dapat dipilih atau diubah." : ""}
                  </p>
                </div>
                <Link prefetch className="btn secondary" href={`/tasks?tab=list&page=${currentPage}`}>Batal</Link>
              </div>
              <form action={updateTask} className="form section-sm">
                <input type="hidden" name="task_id" value={editTask.id} />
                <TaskIdentityFields
                  employees={employees}
                  kpis={kpis}
                  tupoksi={tupoksi}
                  defaultEmployeeId={editTask.assigned_to}
                  defaultKpiId={editTask.support_kpi_id || ""}
                  defaultTupoksiId={editTask.support_tupoksi_id || ""}
                  defaultTitle={editTask.title}
                  defaultDescription={editTask.description || ""}
                  lockIdentity={submittedTaskIds.has(editTask.id)}
                />
                <div className="form-row three">
                  <div className="field">
                    <label>Priority</label>
                    <select name="priority" defaultValue={editTask.priority}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Kompleksitas</label>
                    <select name="complexity" defaultValue={editTask.complexity}>
                      {COMPLEXITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Due date</label><input name="due_date" type="date" defaultValue={editTask.due_at ? editTask.due_at.slice(0, 10) : ""} /></div>
                </div>
                <button className="btn" type="submit">Simpan Perubahan</button>
              </form>
            </section>
          ) : null}

          <section className={`${editTask ? "section " : ""}table-wrap teamtasks-table-wrap`}>
            <table className="teamtasks-table">
              <colgroup>
                <col style={{ width: "17%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead><tr><th>Task</th><th>Employee</th><th>Periode</th><th>Support KPI</th><th>Support Tupoksi</th><th>Status</th><th>Priority</th><th>Kompleksitas</th><th>Due</th><th style={{ textAlign: "center" }}>Action</th></tr></thead>
              <tbody>
                {visibleTasks.map((task) => {
                  const kpi = kpiFor(task);
                  const tupoksiItem = tupoksiFor(task);
                  const hasSubmission = submittedTaskIds.has(task.id);
                  const isCarryOver = Boolean(period && task.period_id !== period.id);
                  return (
                    <tr key={task.id} style={isCarryOver ? { background: "#fffdf7" } : undefined}>
                      <td title={task.title}>
                        <div className="teamtasks-clamp teamtasks-title">
                          <strong>{task.title}</strong>
                          {isCarryOver ? <span className="teamtasks-carry">Carry Over</span> : null}
                        </div>
                      </td>
                      <td title={task.employees?.full_name || ""}><div className="teamtasks-clamp one">{task.employees?.full_name}</div></td>
                      <td title={periodLabels.get(task.period_id) || "-"}><div className="teamtasks-clamp one">{periodLabels.get(task.period_id) || "-"}</div></td>
                      <td title={kpi ? `${kpi.kpi_code} · ${kpi.kpi_description}` : "-"}>
                        {kpi ? <div className="teamtasks-clamp"><strong>{kpi.kpi_code}</strong> · {kpi.kpi_description}</div> : <span className="muted">-</span>}
                      </td>
                      <td title={tupoksiItem ? `${tupoksiItem.tupoksi_code} · ${tupoksiItem.tupoksi_description}` : "-"}>
                        {tupoksiItem ? <div className="teamtasks-clamp"><strong>{tupoksiItem.tupoksi_code}</strong> · {tupoksiItem.tupoksi_description}</div> : <span className="muted">-</span>}
                      </td>
                      <td><StatusBadge status={task.status} /></td>
                      <td>{task.priority}</td>
                      <td>{complexityLabel(task.complexity)}</td>
                      <td>{task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</td>
                      <td className="teamtasks-action-cell" style={{ textAlign: "center", position: "relative", overflow: "visible" }}>
                        {isCarryOver ? (
                          task.status === "submitted" ? (
                            <Link prefetch className="btn secondary" href="/reviews?tab=validation&page=1" style={{ padding: "6px 8px", fontSize: 11 }}>Validasi</Link>
                          ) : (
                            <span className="muted small">Monitor</span>
                          )
                        ) : (
                          <TaskActionMenu
                            taskId={task.id}
                            taskTitle={task.title}
                            currentPage={currentPage}
                            hasSubmission={hasSubmission}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tasks.length === 0 ? <tr><td colSpan={10} className="empty">Belum ada task minggu berjalan maupun task open dari periode sebelumnya.</td></tr> : null}
              </tbody>
            </table>
          </section>

          {tasks.length > 0 ? (
            <div className="teamtasks-pagination">
              <span className="muted small">Menampilkan {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, tasks.length)} dari {tasks.length} task</span>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {currentPage > 1 ? (
                  <Link prefetch className="btn secondary" href={`/tasks?tab=list&page=${currentPage - 1}`}>← Sebelumnya</Link>
                ) : (
                  <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>← Sebelumnya</span>
                )}
                <span className="badge">{currentPage} / {totalPages}</span>
                {currentPage < totalPages ? (
                  <Link prefetch className="btn secondary" href={`/tasks?tab=list&page=${currentPage + 1}`}>Berikutnya →</Link>
                ) : (
                  <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>Berikutnya →</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
