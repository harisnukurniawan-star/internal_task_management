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

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  const employee = await getEmployeeForProfile(profile.id);
  const period = await getCurrentPeriod();
  if (!employee) return <p>Employee profile belum ditautkan.</p>;

  let taskQuery = supabase
    .from("tasks")
    .select("id,title,description,status,priority,complexity,due_at,support_kpi_id,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description,achievement)")
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
      <div className="grid-2">
        {tasks.map((task) => {
          const claim = latestByTask.get(task.id);
          const evaluation = claim?.task_evaluations;
          const canSubmit = ["assigned", "in_progress", "revision"].includes(task.status);
          const kpi = kpiFor(task);
          return (
            <section className="card compact" key={task.id}>
              <div className="card-head"><strong>{task.title}</strong><StatusBadge status={task.status} /></div>
              <p className="muted clamp">{task.description || "Tanpa deskripsi"}</p>
              <div className="notice neutral">
                <strong>Support KPI</strong><br />
                {kpi ? <><span>{kpi.kpi_code}</span><br /><span className="small">{kpi.kpi_description}{kpi.achievement != null ? ` · Capaian referensi ${kpi.achievement}%` : ""}</span></> : <span className="muted">Belum ditetapkan oleh atasan.</span>}
              </div>
              <div className="task-meta">
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
                      <span>Quality: {qualityLabel(evaluation.quality)}</span><span>Kompleksitas: {Number(evaluation.complexity_score).toFixed(1)}</span><span>Ketepatan waktu: {Number(evaluation.timeliness_score).toFixed(1)}</span><span>Quality score: {Number(evaluation.quality_score).toFixed(1)}</span><span>Completion: {Number(evaluation.completion_score).toFixed(1)}</span><span><strong>Skor aktivitas: {Number(evaluation.score).toFixed(2)}</strong></span>
                      {evaluation.feedback ? <p>{evaluation.feedback}</p> : null}
                    </div>
                  ) : task.status === "submitted" ? <div className="notice neutral">Menunggu review Supervisor untuk penilaian Quality dan skor final.</div> : null}
                </div>
              ) : null}

              {canSubmit ? (
                <form action={submitClaim} className="form section-sm">
                  <input type="hidden" name="task_id" value={task.id} />
                  <div className="submission-box"><strong>Deskripsi Task</strong><p>{task.description || "Tanpa deskripsi"}</p></div>
                  <div className="notice neutral"><strong>Support KPI</strong><br />{kpi ? <><span>{kpi.kpi_code}</span><br /><span className="small">{kpi.kpi_description}</span></> : <span className="muted">Belum ditetapkan oleh atasan.</span>}</div>
                  <div className="form-row three">
                    <div className="field"><label>Realisasi (target penyelesaian)</label><input name="completion_percent" type="number" min="0" max="100" step="1" required placeholder="0 - 100" /></div>
                    <div className="field"><label>Priority</label><input value={task.priority} readOnly disabled /></div>
                    <div className="field"><label>Kompleksitas</label><input value={complexityLabel(task.complexity)} readOnly disabled /></div>
                  </div>
                  <div className="field">
                    <label>Status progress</label>
                    <div className="page-tabs"><label className="page-tab"><input type="radio" name="progress_status" value="selesai" required /> Selesai</label><label className="page-tab"><input type="radio" name="progress_status" value="lanjut_pekan_depan" required /> Lanjut pekan depan</label></div>
                    <small className="muted">Selesai = 100%. Lanjut pekan depan = realisasi masih di bawah 100%.</small>
                  </div>
                  <div className="field"><label>Komentar / Keterangan <span className="muted">(opsional)</span></label><textarea name="employee_comment" maxLength={500} placeholder="Tambahkan catatan, kendala, atau informasi tambahan..." /></div>
                  <div className="field"><label>Upload evidence <span className="muted">(opsional)</span></label><input name="evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /><small className="muted">PDF/JPG/PNG/WebP · maks. 3 MB.</small></div>
                  <button className="btn" type="submit">{task.status === "revision" ? "Kirim Revisi" : "Submit Realisasi"}</button>
                </form>
              ) : null}
            </section>
          );
        })}
      </div>
      {tasks.length === 0 ? <div className="card empty">Belum ada task untuk minggu ini.</div> : null}
    </>
  );
}
