import Link from "next/link";
import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { complexityLabel, qualityLabel } from "@/lib/scoring";
import { EvidenceFileInput } from "./evidence-file-input";
import { submitClaim } from "../actions";

const OPEN_TASK_STATUSES = ["assigned", "in_progress", "submitted", "revision"];
const CLOSED_TASK_STATUSES = ["approved", "rejected"];

function periodFor(task: any) {
  return Array.isArray(task.weekly_periods) ? task.weekly_periods[0] : task.weekly_periods;
}

function kpiFor(task: any) {
  return Array.isArray(task.employee_kpis) ? task.employee_kpis[0] : task.employee_kpis;
}

function tupoksiFor(task: any) {
  return Array.isArray(task.employee_tupoksi) ? task.employee_tupoksi[0] : task.employee_tupoksi;
}

type MyTasksSearchParams = FlashParams & { task?: string; tab?: string; page?: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


async function CompletedTaskHistory({ params }: { params: MyTasksSearchParams }) {
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id, supabase);
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  const completedSelect = "id,period_id,title,status,priority,complexity,due_at,created_at,support_kpi_id,support_tupoksi_id,weekly_periods!inner(label,week_start),employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description,achievement),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)";
  const { data: completedRows, error: completedError } = await supabase
    .from("tasks")
    .select(completedSelect)
    .eq("assigned_to", employee.id)
    .in("status", CLOSED_TASK_STATUSES)
    .order("created_at", { ascending: false });
  if (completedError) throw new Error("Riwayat task gagal dimuat. Silakan coba lagi.");

  const completedTasks = completedRows ?? [];
  const taskIds = completedTasks.map((task) => task.id);
  const latestByTask = new Map<string, any>();

  if (taskIds.length > 0) {
    const { data: claimRows } = await supabase
      .from("task_claims")
      .select("id,task_id,version,submitted_at,task_evaluations(decision,score,evaluated_at)")
      .in("task_id", taskIds)
      .order("version", { ascending: false });
    for (const claim of claimRows ?? []) {
      if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
    }
  }

  const pageSize = 6;
  const requestedPage = Number.parseInt(params.page || "1", 10);
  const totalPages = Math.max(1, Math.ceil(completedTasks.length / pageSize));
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const visibleTasks = completedTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="mytasks-completed-fit">
      <style>{`
        .mytasks-completed-fit{height:calc(100vh - 44px);min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:7px}
        .mytasks-completed-fit .topbar{margin-bottom:2px;flex:0 0 auto}
        .mytasks-completed-fit .page-tabs{margin:0;flex:0 0 auto}
        .staff-completed-panel{display:flex;flex-direction:column;gap:7px;min-height:0;flex:1 1 auto}
        .staff-completed-table-wrap{overflow:visible!important;min-height:0;flex:1 1 auto;border-radius:11px}
        .staff-completed-table{table-layout:fixed;width:100%}
        .staff-completed-table th,.staff-completed-table td{padding:7px 8px;font-size:11px;line-height:1.2;vertical-align:middle;overflow:hidden}
        .staff-completed-table th{height:32px}
        .staff-completed-table tbody tr{height:52px}
        .staff-completed-table td{max-height:52px}
        .staff-completed-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-word}
        .staff-completed-clamp.one{-webkit-line-clamp:1}
        .staff-completed-table .badge{font-size:9px;padding:3px 6px;white-space:nowrap}
        .staff-completed-pagination{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;position:relative;z-index:80;background:#fff;padding:2px 0 1px}
        .staff-completed-pagination .btn{padding:6px 9px;font-size:11px;pointer-events:auto}
        @supports selector(:has(*)){
          .main:has(.mytasks-completed-fit){height:100vh;overflow:hidden;padding-top:22px;padding-bottom:22px}
          .main:has(.mytasks-completed-fit) .mytasks-completed-fit{height:calc(100vh - 44px)}
        }
        @media(max-width:1100px){
          .staff-completed-table th,.staff-completed-table td{padding:6px;font-size:10px}
          .staff-completed-table tbody tr{height:48px}
          .staff-completed-table td{max-height:48px}
        }
        @media(max-width:900px){
          .main:has(.mytasks-completed-fit){height:auto;overflow:visible;padding-top:14px;padding-bottom:14px}
          .mytasks-completed-fit,.main:has(.mytasks-completed-fit) .mytasks-completed-fit{height:auto;overflow:visible}
          .staff-completed-table-wrap{overflow:auto!important}
        }
      `}</style>

      <PageHeader title="My Tasks" subtitle="Riwayat task seluruh periode yang sudah selesai divalidasi atau ditutup." />
      <FlashMessage params={params} />

      <nav className="page-tabs" aria-label="My task sections">
        <Link prefetch className="page-tab" href="/my-tasks?tab=todo">Task to Do</Link>
        <Link prefetch className="page-tab active" href="/my-tasks?tab=completed&page=1">Task Completed</Link>
      </nav>

      <div className="staff-completed-panel">
        <section className="table-wrap staff-completed-table-wrap">
          <table className="staff-completed-table">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Task</th>
                <th>Periode</th>
                <th>Support KPI</th>
                <th>Support Tupoksi</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Kompleksitas</th>
                <th>Due</th>
                <th>Score</th>
                <th>Evaluated</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((task) => {
                const kpi = kpiFor(task);
                const tupoksi = tupoksiFor(task);
                const claim = latestByTask.get(task.id);
                const rawEvaluation = claim?.task_evaluations;
                const evaluation = Array.isArray(rawEvaluation) ? rawEvaluation[0] : rawEvaluation;
                return (
                  <tr key={task.id}>
                    <td title={task.title}><div className="staff-completed-clamp"><strong>{task.title}</strong></div></td>
                    <td title={periodFor(task)?.label || "-"}><div className="staff-completed-clamp one">{periodFor(task)?.label || "-"}</div></td>
                    <td title={kpi ? `${kpi.kpi_code} · ${kpi.kpi_description}` : "-"}>
                      {kpi ? <div className="staff-completed-clamp"><strong>{kpi.kpi_code}</strong> · {kpi.kpi_description}</div> : <span className="muted">-</span>}
                    </td>
                    <td title={tupoksi ? `${tupoksi.tupoksi_code} · ${tupoksi.tupoksi_description}` : "-"}>
                      {tupoksi ? <div className="staff-completed-clamp"><strong>{tupoksi.tupoksi_code}</strong> · {tupoksi.tupoksi_description}</div> : <span className="muted">-</span>}
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td>{task.priority}</td>
                    <td><div className="staff-completed-clamp">{complexityLabel(task.complexity)}</div></td>
                    <td>{task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</td>
                    <td>{task.status === "approved" && evaluation?.score != null ? <strong>{Number(evaluation.score).toFixed(2)}</strong> : <span className="muted">-</span>}</td>
                    <td>{evaluation?.evaluated_at ? new Date(evaluation.evaluated_at).toLocaleDateString("id-ID") : "-"}</td>
                  </tr>
                );
              })}
              {completedTasks.length === 0 ? (
                <tr><td colSpan={10} className="empty">Belum ada riwayat task completed.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {completedTasks.length > 0 ? (
          <div className="staff-completed-pagination">
            <span className="muted small">
              Menampilkan {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, completedTasks.length)} dari {completedTasks.length} task
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {currentPage > 1 ? (
                <Link prefetch className="btn secondary" href={`/my-tasks?tab=completed&page=${currentPage - 1}`}>← Sebelumnya</Link>
              ) : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>← Sebelumnya</span>}
              <span className="badge">{currentPage} / {totalPages}</span>
              {currentPage < totalPages ? (
                <Link prefetch className="btn secondary" href={`/my-tasks?tab=completed&page=${currentPage + 1}`}>Berikutnya →</Link>
              ) : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>Berikutnya →</span>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<MyTasksSearchParams> }) {
  const params = await searchParams;
  const selectedTaskId = typeof params.task === "string" && UUID_PATTERN.test(params.task) ? params.task : null;
  const activeTab = !selectedTaskId && params.tab === "completed" ? "completed" : "todo";
  if (activeTab === "completed") return <CompletedTaskHistory params={params} />;
  const { supabase, profile } = await requireProfile();
  const [employee, period] = await Promise.all([
    getEmployeeForProfile(profile.id, supabase),
    getCurrentPeriod(supabase),
  ]);
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  const taskSelect = "id,period_id,title,description,status,priority,complexity,due_at,support_kpi_id,support_tupoksi_id,weekly_periods!inner(label,week_start),employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description,achievement),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)";

  const periodBoundary = period?.week_start ?? new Date().toISOString().slice(0, 10);
  let taskQuery = supabase
    .from("tasks")
    .select(taskSelect)
    .eq("assigned_to", employee.id)
    .lte("weekly_periods.week_start", periodBoundary);
  // My Tasks is an active-work queue: show only open workflow statuses
  // for both the current period and carry-over periods.
  taskQuery = taskQuery.in("status", OPEN_TASK_STATUSES);
  const { data: taskRows, error: taskError } = await taskQuery.order("created_at", { ascending: false });
  if (taskError) throw new Error("Daftar task gagal dimuat. Silakan coba lagi.");
  const tasks = taskRows ?? [];

  if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
    const { data: selectedTask } = await supabase
      .from("tasks")
      .select(taskSelect)
      .eq("id", selectedTaskId)
      .eq("assigned_to", employee.id)
      .in("status", OPEN_TASK_STATUSES)
      .maybeSingle();
    if (selectedTask) tasks.unshift(selectedTask);
  }

  const carryOverIds = new Set(
    tasks
      .filter((task) => OPEN_TASK_STATUSES.includes(task.status) && periodFor(task)?.week_start < periodBoundary)
      .map((task) => task.id),
  );
  tasks.sort((a, b) => {
    const aCarry = carryOverIds.has(a.id);
    const bCarry = carryOverIds.has(b.id);
    if (aCarry !== bCarry) return aCarry ? -1 : 1;
    if (!aCarry) return 0;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
  const taskIds = tasks.map((task) => task.id);

  const latestByTask = new Map<string, any>();
  if (taskIds.length > 0) {
    const { data: claimRows } = await supabase
      .from("task_claims")
      .select("id,task_id,version,realization_summary,completion_percent,progress_status,employee_comment,submitted_at,task_evaluations(decision,quality,score,complexity_score,timeliness_score,quality_score,completion_score,feedback,evaluated_at),evidence_files(id,file_name,file_size)")
      .in("task_id", taskIds)
      .order("version", { ascending: false });
    for (const claim of claimRows ?? []) if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
  }

  return (
    <div className="mytasks-fit">
      <div className="mytasks-head">
        <PageHeader title="My Tasks" subtitle={period ? `${period.label} · termasuk carry over dari periode sebelumnya` : "Task terbuka, termasuk carry over dari periode sebelumnya"} />
        <FlashMessage params={params} />
        <nav className="page-tabs" aria-label="My task sections">
          <Link prefetch className="page-tab active" href="/my-tasks?tab=todo">Task to Do</Link>
          <Link prefetch className="page-tab" href="/my-tasks?tab=completed&page=1">Task Completed</Link>
        </nav>
        {carryOverIds.size > 0 ? (
          <div className="notice warning">
            {carryOverIds.size} task carry over belum selesai / belum divalidasi. Periode dan deadline asal tetap dipertahankan.
          </div>
        ) : null}
      </div>

      <style>{`
        .mytasks-fit{height:calc(100vh - 44px);min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:6px}
        .mytasks-head{flex:0 0 auto}
        .mytasks-fit .topbar{margin-bottom:5px}
        .mytasks-fit .page-tabs{margin:0;flex:0 0 auto}
        .task-tile-grid{align-items:start;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px;flex:1 1 auto;min-height:0;overflow-y:auto}
        .task-accordion{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 3px 12px #2a35870d;overflow:hidden;min-width:0}
        .task-tile-grid:has(.task-accordion[open]) .task-accordion:not([open]){display:none}
        .task-accordion[open]{grid-column:1/-1;height:100%;min-height:0;display:flex;flex-direction:column}
        .task-tile-summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 11px;min-height:52px;flex:0 0 auto}
        .task-tile-summary::-webkit-details-marker{display:none}
        .task-tile-summary:hover{background:var(--blue-soft)}
        .task-tile-main{display:grid;gap:4px;min-width:0}
        .task-tile-main strong{font-size:14px;color:var(--text);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .task-tile-due{font-size:11px;color:var(--muted)}
        .task-tile-side{display:flex;align-items:flex-end;gap:4px;flex-direction:column;flex:0 0 auto}
        .task-open-label{font-size:10px;font-weight:700;color:var(--navy)}
        .task-accordion[open] .task-open-label{font-size:0}
        .task-accordion[open] .task-open-label:after{content:'Tutup detail';font-size:10px}
        .task-detail-body{border-top:1px solid var(--line);padding:7px 9px;flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column}
        .task-detail-meta{margin:0 0 4px;flex:0 0 auto}
        .task-claim-compact{margin:0 0 7px;padding:7px 9px;flex:0 0 auto;max-height:116px;overflow:hidden}
        .task-claim-compact p{margin:4px 0;font-size:12px}
        .task-claim-compact .task-meta{margin-top:0}
        .task-claim-compact .feedback{margin-top:5px;padding:6px;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 8px}
        .employee-submit-grid{display:grid!important;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:8px!important;flex:1 1 auto;min-height:0;margin-top:0!important;overflow:hidden}
        .employee-context-panel,.employee-input-panel{min-width:0;min-height:0;display:flex;flex-direction:column;gap:5px}
        .employee-context-panel .submission-box,.employee-context-panel .notice{margin:0;padding:6px 8px}
        .employee-context-panel .submission-box p{margin:5px 0 0;font-size:12px;line-height:1.3}
        .employee-context-panel .notice{font-size:12px;line-height:1.25}
        .employee-input-panel{overflow:visible}
        .employee-input-panel .form-row{gap:5px}
        .employee-input-panel .field{gap:3px}
        .employee-input-panel .field label{font-size:11px}
        .employee-input-panel .field input,.employee-input-panel .field textarea,.employee-input-panel .field select{padding:6px 8px;font-size:12px;border-radius:8px}
        .employee-input-panel textarea{min-height:38px!important;max-height:42px;resize:none}
        .employee-input-panel input[type=file]{padding:4px 6px}
        .progress-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        .progress-option{display:block!important;cursor:pointer;font-weight:400!important;color:inherit!important}
        .progress-option input{position:absolute;opacity:0;pointer-events:none}
        .progress-choice{display:flex;align-items:center;gap:7px;min-height:42px;padding:5px 8px;border:1px solid #d6daea;border-radius:9px;background:#fff;transition:.15s ease}
        .progress-choice:hover{border-color:var(--navy);background:var(--blue-soft)}
        .progress-icon{width:23px;height:23px;border-radius:7px;background:var(--blue-soft-2);color:var(--navy);display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 auto}
        .progress-choice>span:last-child{display:grid;gap:1px}
        .progress-choice strong{font-size:12px;color:var(--navy2)}
        .progress-choice small{font-size:10px;color:var(--muted);font-weight:400}
        .progress-option input:checked + .progress-choice{border-color:var(--navy);background:var(--blue-soft);box-shadow:0 0 0 2px #2a35871a inset}
        .progress-option input:checked + .progress-choice .progress-icon{background:var(--navy);color:#fff}
        .employee-input-panel .btn{padding:7px 10px;flex:0 0 auto;display:block!important;width:100%;margin-top:1px;position:relative;z-index:2}
        @supports selector(:has(*)){
          .main:has(.mytasks-fit){height:100vh;overflow:hidden;padding-top:12px;padding-bottom:12px}
          .main:has(.mytasks-fit) .mytasks-fit{height:calc(100vh - 24px)}
        }
        @media(max-width:900px){.main:has(.mytasks-fit){height:auto;overflow:visible;padding-top:14px;padding-bottom:14px}.mytasks-fit{height:auto;overflow:visible}.task-tile-grid{overflow:visible}.task-tile-grid:has(.task-accordion[open]) .task-accordion:not([open]){display:block}.task-accordion[open]{height:auto}.task-detail-body{overflow:visible}.employee-submit-grid{grid-template-columns:1fr}.employee-input-panel{overflow:visible}}
        @media(max-width:700px){.progress-choice-grid{grid-template-columns:1fr}.task-accordion[open]{grid-column:auto}.task-tile-summary{align-items:flex-start}.task-tile-main strong{white-space:normal}}
      `}</style>

      <div className="task-tile-grid">
        {tasks.map((task) => {
          const isCarryOver = carryOverIds.has(task.id);
          const taskPeriod = periodFor(task);
          const claim = latestByTask.get(task.id);
          const evaluation = claim?.task_evaluations;
          const canSubmit = ["assigned", "in_progress", "revision"].includes(task.status);
          const kpi = kpiFor(task);
          const tupoksi = tupoksiFor(task);
          const hasEvidence = (claim?.evidence_files?.length ?? 0) > 0;

          return (
            <details className="task-accordion" name="employee-task" key={task.id} open={task.id === selectedTaskId}>
              <summary className="task-tile-summary">
                <div className="task-tile-main">
                  <strong>{task.title}</strong>
                  {isCarryOver ? <span className="task-tile-due" style={{ color: "var(--amber)", fontWeight: 700 }}>Carry over · {taskPeriod?.label || "Periode sebelumnya"}</span> : null}
                  <span className="task-tile-due">Due: {task.due_at ? new Date(task.due_at).toLocaleDateString("id-ID") : "-"}</span>
                </div>
                <div className="task-tile-side">
                  <StatusBadge status={task.status} />
                  <span className="task-open-label">Lihat detail</span>
                </div>
              </summary>

              <div className="task-detail-body">
                <div className="task-meta task-detail-meta">
                  <span>Priority: {task.priority}</span>
                  <span>Kompleksitas: {complexityLabel(task.complexity)}</span>
                  <span>Due: {task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</span>
                </div>

                {claim ? (
                  <div className="submission-box task-claim-compact">
                    <div className="task-meta"><span>Submission v{claim.version}</span><span>Dikirim: {new Date(claim.submitted_at).toLocaleString("id-ID")}</span></div>
                    <p><strong>Realisasi:</strong> {Number(claim.completion_percent).toFixed(0)}% · {claim.progress_status === "lanjut_pekan_depan" ? "Lanjut pekan depan" : "Selesai"}</p>
                    {claim.employee_comment ? <p><strong>Keterangan:</strong> {claim.employee_comment}</p> : null}
                    {hasEvidence ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                        {claim.evidence_files.map((file: any, index: number) => (
                          <a
                            key={file.id}
                            className="evidence-link"
                            href={`/evidence/${claim.id}?file=${encodeURIComponent(file.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            title={file.file_name}
                            style={{ maxWidth: "100%" }}
                          >
                            Evidence {index + 1} · {file.file_name}
                          </a>
                        ))}
                      </div>
                    ) : <span className="muted small">Belum ada evidence</span>}
                    {evaluation ? (
                      <div className={`feedback ${evaluation.decision}`}>
                        <strong>
                          {evaluation.decision === "revision"
                            ? "Perlu revisi · form aktif"
                            : evaluation.decision === "rejected"
                              ? "Aktivitas dibatalkan · form terkunci"
                              : "Approved"}
                        </strong>
                        {evaluation.decision === "approved" ? (
                          <>
                            <span>Quality: {qualityLabel(evaluation.quality)}</span>
                            <span>Waktu: {Number(evaluation.timeliness_score).toFixed(1)}</span>
                            <span>Completion: {Number(evaluation.completion_score).toFixed(1)}</span>
                            <span><strong>Skor: {Number(evaluation.score).toFixed(2)}</strong></span>
                          </>
                        ) : null}
                        {evaluation.feedback ? <span>{evaluation.feedback}</span> : null}
                      </div>
                    ) : task.status === "submitted" ? <div className="muted small">Menunggu review Supervisor.</div> : null}
                  </div>
                ) : null}

                {canSubmit ? (
                  <form action={submitClaim} className="employee-submit-grid">
                    <input type="hidden" name="task_id" value={task.id} />

                    <div className="employee-context-panel">
                      <div className="submission-box">
                        <strong>Deskripsi Task</strong>
                        <p>{task.description || "Tanpa deskripsi"}</p>
                      </div>

                      <div className="notice neutral">
                        <strong>Support KPI</strong><br />
                        {kpi ? <><span>{kpi.kpi_code}</span><br /><span className="small">{kpi.kpi_description}</span></> : <span className="muted">Belum ditetapkan oleh atasan.</span>}
                      </div>

                      <div className="notice neutral">
                        <strong>Support Tupoksi</strong><br />
                        {tupoksi ? <><span>{tupoksi.tupoksi_code}</span><br /><span className="small">{tupoksi.tupoksi_description}</span></> : <span className="muted">Belum ditetapkan oleh atasan.</span>}
                      </div>
                    </div>

                    <div className="employee-input-panel">
                      <div className="form-row three">
                        <div className="field">
                          <label>Realisasi (%)</label>
                          <input name="completion_percent" type="number" min="0" max="100" step="1" required placeholder="0 - 100" />
                        </div>
                        <div className="field"><label>Priority</label><input value={task.priority} readOnly disabled /></div>
                        <div className="field"><label>Kompleksitas</label><input value={complexityLabel(task.complexity)} readOnly disabled /></div>
                      </div>

                      <div className="field">
                        <label>Status progress</label>
                        <div className="progress-choice-grid">
                          <label className="progress-option">
                            <input type="radio" name="progress_status" value="selesai" required />
                            <span className="progress-choice">
                              <span className="progress-icon">✓</span>
                              <span><strong>Selesai</strong><small>Target 100%</small></span>
                            </span>
                          </label>
                          <label className="progress-option">
                            <input type="radio" name="progress_status" value="lanjut_pekan_depan" required />
                            <span className="progress-choice">
                              <span className="progress-icon">→</span>
                              <span><strong>Lanjut pekan depan</strong><small>Progres &lt; 100%</small></span>
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="field">
                        <label>Komentar / Keterangan <span className="muted">(opsional)</span></label>
                        <textarea name="employee_comment" maxLength={500} placeholder="Catatan atau kendala..." />
                      </div>
                      <div className="field">
                        <label>Upload evidence <span className="muted">(wajib)</span></label>
                        <EvidenceFileInput />
                      </div>
                      <button className="btn" type="submit">{task.status === "revision" ? "Kirim Revisi" : "Submit Realisasi"}</button>
                    </div>
                  </form>
                ) : task.status === "rejected" ? (
                  <div className="notice neutral">
                    <strong>Aktivitas dibatalkan oleh Supervisor.</strong><br />
                    Form input dinonaktifkan dan aktivitas ini tidak dihitung sebagai nilai.
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>

      {tasks.length === 0 ? <div className="card empty">Belum ada task minggu ini maupun carry over.</div> : null}
    </div>
  );
}
