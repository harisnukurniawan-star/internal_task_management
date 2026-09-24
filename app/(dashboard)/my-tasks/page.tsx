import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";
import { complexityLabel, qualityLabel } from "@/lib/scoring";
import { submitClaim } from "../actions";

function kpiFor(task: any) {
  return Array.isArray(task.employee_kpis) ? task.employee_kpis[0] : task.employee_kpis;
}

function tupoksiFor(task: any) {
  return Array.isArray(task.employee_tupoksi) ? task.employee_tupoksi[0] : task.employee_tupoksi;
}

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  const period = await getCurrentPeriod();
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  let taskQuery = supabase
    .from("tasks")
    .select("id,title,description,status,priority,complexity,due_at,support_kpi_id,support_tupoksi_id,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description,achievement),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)")
    .eq("assigned_to", employee.id);
  if (period) taskQuery = taskQuery.eq("period_id", period.id);
  const { data: taskRows } = await taskQuery.order("created_at", { ascending: false });
  const tasks = taskRows ?? [];
  const taskIds = tasks.map((task) => task.id);

  const latestByTask = new Map<string, any>();
  if (taskIds.length > 0) {
    const { data: claimRows } = await supabase
      .from("task_claims")
      .select("id,task_id,version,realization_summary,completion_percent,progress_status,employee_comment,submitted_at,task_evaluations(decision,quality,score,complexity_score,timeliness_score,quality_score,completion_score,feedback,evaluated_at),evidence_files(file_name,file_size,storage_path)")
      .in("task_id", taskIds)
      .order("version", { ascending: false });
    for (const claim of claimRows ?? []) if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
  }

  const evidenceLinks = new Map<string, string>();
  for (const claim of latestByTask.values()) {
    const evidence = claim.evidence_files?.[0];
    if (!evidence) continue;
    const signed = await supabase.storage.from("task-evidence").createSignedUrl(evidence.storage_path, 300, { download: evidence.file_name });
    if (signed.data?.signedUrl) evidenceLinks.set(claim.id, signed.data.signedUrl);
  }

  return (
    <>
      <PageHeader title="My Tasks" subtitle={period?.label || "Task periode aktif"} />
      <FlashMessage params={params} />

      <style>{`
        .task-tile-grid{align-items:start}
        .task-accordion{background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 3px 12px #2a35870d;overflow:hidden}
        .task-accordion[open]{grid-column:1/-1}
        .task-tile-summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;min-height:78px}
        .task-tile-summary::-webkit-details-marker{display:none}
        .task-tile-summary:hover{background:var(--blue-soft)}
        .task-tile-main{display:grid;gap:7px;min-width:0}
        .task-tile-main strong{font-size:15px;color:var(--text);line-height:1.35}
        .task-tile-due{font-size:12px;color:var(--muted)}
        .task-tile-side{display:flex;align-items:flex-end;gap:7px;flex-direction:column;flex:0 0 auto}
        .task-open-label{font-size:11px;font-weight:700;color:var(--navy)}
        .task-accordion[open] .task-open-label{font-size:0}
        .task-accordion[open] .task-open-label:after{content:'Tutup detail';font-size:11px}
        .task-detail-body{border-top:1px solid var(--line);padding:15px}
        .task-detail-meta{margin-top:0;margin-bottom:6px}
        .progress-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .progress-option{display:block!important;cursor:pointer;font-weight:400!important;color:inherit!important}
        .progress-option input{position:absolute;opacity:0;pointer-events:none}
        .progress-choice{display:flex;align-items:center;gap:11px;min-height:66px;padding:11px 13px;border:1px solid #d6daea;border-radius:11px;background:#fff;transition:.15s ease}
        .progress-choice:hover{border-color:var(--navy);background:var(--blue-soft)}
        .progress-icon{width:32px;height:32px;border-radius:9px;background:var(--blue-soft-2);color:var(--navy);display:grid;place-items:center;font-size:18px;font-weight:800;flex:0 0 auto}
        .progress-choice>span:last-child{display:grid;gap:3px}
        .progress-choice strong{font-size:13px;color:var(--navy2)}
        .progress-choice small{font-size:11px;color:var(--muted);font-weight:400}
        .progress-option input:checked + .progress-choice{border-color:var(--navy);background:var(--blue-soft);box-shadow:0 0 0 2px #2a35871a inset}
        .progress-option input:checked + .progress-choice .progress-icon{background:var(--navy);color:#fff}
        @media(max-width:700px){.progress-choice-grid{grid-template-columns:1fr}.task-accordion[open]{grid-column:auto}.task-tile-summary{align-items:flex-start}}
      `}</style>

      <div className="grid-2 task-tile-grid">
        {tasks.map((task) => {
          const claim = latestByTask.get(task.id);
          const evaluation = claim?.task_evaluations;
          const canSubmit = ["assigned", "in_progress", "revision"].includes(task.status);
          const kpi = kpiFor(task);
          const tupoksi = tupoksiFor(task);

          return (
            <details className="task-accordion" key={task.id}>
              <summary className="task-tile-summary">
                <div className="task-tile-main">
                  <strong>{task.title}</strong>
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
                  <div className="submission-box">
                    <div className="task-meta"><span>Submission v{claim.version}</span><span>Dikirim: {new Date(claim.submitted_at).toLocaleString("id-ID")}</span></div>
                    <p><strong>Realisasi:</strong> {Number(claim.completion_percent).toFixed(0)}% · {claim.progress_status === "lanjut_pekan_depan" ? "Lanjut pekan depan" : "Selesai"}</p>
                    {claim.employee_comment ? <p><strong>Keterangan:</strong> {claim.employee_comment}</p> : null}
                    {evidenceLinks.get(claim.id) ? <a className="evidence-link" href={evidenceLinks.get(claim.id)} target="_blank" rel="noreferrer">Buka evidence</a> : <span className="muted small">Belum ada evidence</span>}
                    {evaluation ? (
                      <div className={`feedback ${evaluation.decision}`}>
                        <strong>{evaluation.decision === "revision" ? "Perlu revisi" : evaluation.decision}</strong>
                        <span>Quality: {qualityLabel(evaluation.quality)}</span>
                        <span>Kompleksitas: {Number(evaluation.complexity_score).toFixed(1)}</span>
                        <span>Ketepatan waktu: {Number(evaluation.timeliness_score).toFixed(1)}</span>
                        <span>Quality score: {Number(evaluation.quality_score).toFixed(1)}</span>
                        <span>Completion: {Number(evaluation.completion_score).toFixed(1)}</span>
                        <span><strong>Skor aktivitas: {Number(evaluation.score).toFixed(2)}</strong></span>
                        {evaluation.feedback ? <p>{evaluation.feedback}</p> : null}
                      </div>
                    ) : task.status === "submitted" ? <div className="notice neutral">Menunggu review Supervisor untuk penilaian Quality dan skor final.</div> : null}
                  </div>
                ) : null}

                {canSubmit ? (
                  <form action={submitClaim} className="form section-sm">
                    <input type="hidden" name="task_id" value={task.id} />

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

                    <div className="form-row three">
                      <div className="field">
                        <label>Realisasi (target penyelesaian)</label>
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
                            <span><strong>Selesai</strong><small>Target penyelesaian 100%</small></span>
                          </span>
                        </label>
                        <label className="progress-option">
                          <input type="radio" name="progress_status" value="lanjut_pekan_depan" required />
                          <span className="progress-choice">
                            <span className="progress-icon">→</span>
                            <span><strong>Lanjut pekan depan</strong><small>Aktivitas masih berprogres &lt; 100%</small></span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="field">
                      <label>Komentar / Keterangan <span className="muted">(opsional)</span></label>
                      <textarea name="employee_comment" maxLength={500} placeholder="Tambahkan catatan, kendala, atau informasi tambahan..." />
                    </div>
                    <div className="field">
                      <label>Upload evidence <span className="muted">(opsional)</span></label>
                      <input name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                      <small className="muted">PDF/JPG/PNG/WebP · maks. 3 MB.</small>
                    </div>
                    <button className="btn" type="submit">{task.status === "revision" ? "Kirim Revisi" : "Submit Realisasi"}</button>
                  </form>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>

      {tasks.length === 0 ? <div className="card empty">Belum ada task untuk minggu ini.</div> : null}
    </>
  );
}
