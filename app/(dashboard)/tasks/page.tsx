import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";
import { COMPLEXITY_OPTIONS, complexityLabel } from "@/lib/scoring";
import { createTask } from "../actions";
import { updateTask } from "./actions";

type TaskSearchParams = FlashParams & { edit?: string; tab?: string };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<TaskSearchParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) return <p>Unauthorized</p>;

  const period = await getCurrentPeriod();
  const employeeResult = await supabase
    .from("employees")
    .select("id,full_name")
    .eq("active", true)
    .order("display_order");
  const employees = employeeResult.data ?? [];

  let tasks: any[] = [];
  const lockedTaskIds = new Set<string>();
  if (period) {
    const taskResult = await supabase
      .from("tasks")
      .select("id,title,description,status,priority,complexity,due_at,assigned_to,employees!tasks_assigned_to_fkey(full_name)")
      .eq("period_id", period.id)
      .order("created_at", { ascending: false });
    tasks = taskResult.data ?? [];

    const taskIds = tasks.map((task) => task.id);
    if (taskIds.length > 0) {
      const claimResult = await supabase
        .from("task_claims")
        .select("task_id")
        .in("task_id", taskIds);
      for (const claim of claimResult.data ?? []) lockedTaskIds.add(claim.task_id);
    }
  }

  const requestedEditTask = params.edit ? tasks.find((task) => task.id === params.edit) : null;
  const editTask = requestedEditTask && !lockedTaskIds.has(requestedEditTask.id) && ["assigned", "in_progress"].includes(requestedEditTask.status)
    ? requestedEditTask
    : null;
  const activeTab = params.edit ? "list" : params.tab === "assign" ? "assign" : "list";

  return (
    <>
      <PageHeader
        title="Team Tasks"
        subtitle={period ? `${period.label} · assign dan monitor task minggu berjalan.` : "Periode aktif belum tersedia."}
      />
      <FlashMessage params={params} />

      <nav className="page-tabs" aria-label="Team task sections">
        <a className={`page-tab ${activeTab === "assign" ? "active" : ""}`} href="/tasks?tab=assign">
          Assign Task
        </a>
        <a className={`page-tab ${activeTab === "list" ? "active" : ""}`} href="/tasks?tab=list">
          Daftar Task
        </a>
      </nav>

      {activeTab === "assign" ? (
        period ? (
          <section className="card compact tab-panel">
            <h3>Assign task</h3>
            <form action={createTask} className="form">
              <input type="hidden" name="period_id" value={period.id} />
              <div className="form-row">
                <div className="field">
                  <label>Judul task</label>
                  <input name="title" required maxLength={160} />
                </div>
                <div className="field">
                  <label>Assign ke</label>
                  <select name="assigned_to" required>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Deskripsi</label>
                <textarea name="description" maxLength={1200} />
              </div>
              <div className="form-row three">
                <div className="field">
                  <label>Priority</label>
                  <select name="priority" defaultValue="medium">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="field">
                  <label>Kompleksitas</label>
                  <select name="complexity" defaultValue="administrasi">
                    {COMPLEXITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input name="due_date" type="date" />
                </div>
              </div>
              <button className="btn" type="submit">Assign Task</button>
            </form>
          </section>
        ) : (
          <div className="notice warning tab-panel">Periode aktif belum tersedia sehingga task belum dapat di-assign.</div>
        )
      ) : (
        <div className="tab-panel">
          {requestedEditTask && !editTask ? (
            <div className="notice warning" id="edit-task">
              Task ini sudah memiliki submission/evidence atau statusnya sudah terkunci, sehingga tidak dapat diedit.
            </div>
          ) : null}

          {editTask ? (
            <section className="card compact" id="edit-task">
              <div className="card-head">
                <div>
                  <h3>Edit task</h3>
                  <p className="muted small" style={{ margin: 0 }}>Hanya Admin dan Supervisor. Edit dikunci setelah pegawai mengirim submission/evidence.</p>
                </div>
                <a className="btn secondary" href="/tasks?tab=list">Batal</a>
              </div>
              <form action={updateTask} className="form section-sm">
                <input type="hidden" name="task_id" value={editTask.id} />
                <div className="form-row">
                  <div className="field">
                    <label>Judul task</label>
                    <input name="title" required maxLength={160} defaultValue={editTask.title} />
                  </div>
                  <div className="field">
                    <label>Assign ke</label>
                    <select name="assigned_to" required defaultValue={editTask.assigned_to}>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Deskripsi</label>
                  <textarea name="description" maxLength={1200} defaultValue={editTask.description || ""} />
                </div>
                <div className="form-row three">
                  <div className="field">
                    <label>Priority</label>
                    <select name="priority" defaultValue={editTask.priority}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Kompleksitas</label>
                    <select name="complexity" defaultValue={editTask.complexity}>
                      {COMPLEXITY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input name="due_date" type="date" defaultValue={editTask.due_at ? editTask.due_at.slice(0, 10) : ""} />
                  </div>
                </div>
                <button className="btn" type="submit">Simpan Perubahan</button>
              </form>
            </section>
          ) : null}

          <section className={`${editTask ? "section " : ""}table-wrap`}>
            <table>
              <thead>
                <tr><th>Task</th><th>Employee</th><th>Status</th><th>Priority</th><th>Kompleksitas</th><th>Due</th><th style={{ width: 54, textAlign: "center" }}>Action</th></tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const editable = !lockedTaskIds.has(task.id) && ["assigned", "in_progress"].includes(task.status);
                  return (
                    <tr key={task.id}>
                      <td><strong>{task.title}</strong></td>
                      <td>{task.employees?.full_name}</td>
                      <td><StatusBadge status={task.status} /></td>
                      <td>{task.priority}</td>
                      <td>{complexityLabel(task.complexity)}</td>
                      <td>{task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</td>
                      <td style={{ textAlign: "center", position: "relative" }}>
                        <details style={{ position: "relative", display: "inline-block" }}>
                          <summary
                            aria-label={`Action ${task.title}`}
                            title="Action"
                            style={{
                              cursor: "pointer",
                              listStyle: "none",
                              width: 30,
                              height: 30,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: 8,
                              fontSize: 22,
                              fontWeight: 700,
                              color: "#475467",
                              userSelect: "none",
                            }}
                          >⋮</summary>
                          <div style={{
                            position: "absolute",
                            right: 0,
                            top: 34,
                            zIndex: 20,
                            minWidth: 150,
                            padding: 6,
                            border: "1px solid #dbe4ef",
                            borderRadius: 9,
                            background: "white",
                            boxShadow: "0 10px 28px #0b1f3a1a",
                            textAlign: "left",
                          }}>
                            {editable ? (
                              <a
                                href={`/tasks?tab=list&edit=${task.id}#edit-task`}
                                style={{ display: "block", padding: "8px 10px", borderRadius: 7, fontWeight: 700, fontSize: 12 }}
                              >Edit task</a>
                            ) : (
                              <span className="muted small" style={{ display: "block", padding: "8px 10px" }}>Task terkunci</span>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
                {tasks.length === 0 ? (
                  <tr><td colSpan={7} className="empty">Belum ada task pada periode aktif.</td></tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
