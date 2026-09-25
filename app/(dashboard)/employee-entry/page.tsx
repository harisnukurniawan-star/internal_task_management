import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";
import { complexityLabel, qualityLabel } from "@/lib/scoring";

export default async function EmployeeEntryReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ employee_id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return <p>Unauthorized</p>;

  const [period, employeeResult] = await Promise.all([
    getCurrentPeriod(supabase),
    supabase.from("employees").select("id,full_name").eq("active", true).order("display_order"),
  ]);
  const employees = employeeResult.data ?? [];
  const selectedEmployeeId = employees.some((item) => item.id === params.employee_id)
    ? params.employee_id!
    : employees[0]?.id;
  const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId);

  let tasks: any[] = [];
  if (selectedEmployeeId) {
    let query = supabase
      .from("tasks")
      .select("id,title,description,status,priority,complexity,due_at")
      .eq("assigned_to", selectedEmployeeId);
    if (period) query = query.eq("period_id", period.id);
    const result = await query.order("created_at", { ascending: false });
    tasks = result.data ?? [];
  }

  const taskIds = tasks.map((task) => task.id);
  const latestByTask = new Map<string, any>();
  if (taskIds.length > 0) {
    const { data: claimRows } = await supabase
      .from("task_claims")
      .select("id,task_id,version,realization_summary,submitted_at,task_evaluations(decision,quality,score,complexity_score,timeliness_score,quality_score,completion_score,feedback,evaluated_at),evidence_files(file_name)")
      .in("task_id", taskIds)
      .order("version", { ascending: false });
    for (const claim of claimRows ?? []) {
      if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
    }
  }

  return (
    <>
      <PageHeader
        title="Employee Entry Review"
        subtitle="Preview alur pegawai dari menerima penugasan sampai hasil evaluasi. Mode Admin ini read-only."
      />

      <div className="notice neutral">
        <strong>Alur:</strong> Penugasan → Entry realisasi & evidence → Submit → Validasi atasan & Quality → Skor aktivitas → Leaderboard.
      </div>

      <section className="card compact section-sm">
        <form method="get" className="form-row">
          <div className="field">
            <label>Preview sebagai pegawai</label>
            <select name="employee_id" defaultValue={selectedEmployeeId || ""}>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.full_name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button className="btn" type="submit">Tampilkan Alur</button>
          </div>
        </form>
      </section>

      <div className="topbar section">
        <div className="page-title">
          <h1>{selectedEmployee?.full_name || "Pegawai"}</h1>
          <p>{period?.label || "Periode aktif"} · tampilan entry pegawai yang dapat direview Admin</p>
        </div>
        <span className="badge">Admin Preview</span>
      </div>

      <div className="grid-2">
        {tasks.map((task) => {
          const claim = latestByTask.get(task.id);
          const evaluation = claim?.task_evaluations;
          const hasEvidence = (claim?.evidence_files?.length ?? 0) > 0;
          const employeeCanSubmit = ["assigned", "in_progress", "revision"].includes(task.status);

          return (
            <section className="card compact" key={task.id}>
              <div className="card-head">
                <strong>{task.title}</strong>
                <StatusBadge status={task.status} />
              </div>
              <p className="muted clamp">{task.description || "Tanpa deskripsi"}</p>
              <div className="task-meta">
                <span>Priority: {task.priority}</span>
                <span>Kompleksitas: {complexityLabel(task.complexity)}</span>
                <span>Due: {task.due_at ? new Date(task.due_at).toLocaleString("id-ID") : "-"}</span>
              </div>

              {claim ? (
                <div className="submission-box">
                  <div className="task-meta">
                    <span>Submission v{claim.version}</span>
                    <span>Dikirim: {new Date(claim.submitted_at).toLocaleString("id-ID")}</span>
                  </div>
                  <p>{claim.realization_summary}</p>
                  {hasEvidence ? (
                    <a className="evidence-link" href={`/evidence/${claim.id}`} target="_blank" rel="noreferrer">
                      Buka evidence pegawai
                    </a>
                  ) : (
                    <span className="muted small">Belum ada evidence · Completion = 0</span>
                  )}

                  {evaluation ? (
                    <div className={`feedback ${evaluation.decision}`}>
                      <strong>Hasil evaluasi: {evaluation.decision}</strong>
                      <span>Quality: {qualityLabel(evaluation.quality)}</span>
                      <span>Kompleksitas: {Number(evaluation.complexity_score).toFixed(1)}</span>
                      <span>Ketepatan waktu: {Number(evaluation.timeliness_score).toFixed(1)}</span>
                      <span>Quality score: {Number(evaluation.quality_score).toFixed(1)}</span>
                      <span>Completion: {Number(evaluation.completion_score).toFixed(1)}</span>
                      <span><strong>Skor aktivitas: {Number(evaluation.score).toFixed(2)}</strong></span>
                      {evaluation.feedback ? <p>{evaluation.feedback}</p> : null}
                    </div>
                  ) : task.status === "submitted" ? (
                    <div className="notice neutral">Menunggu Validation & Evaluation dari atasan.</div>
                  ) : null}
                </div>
              ) : null}

              <div className="form section-sm admin-entry-preview">
                <div className="field">
                  <label>{task.status === "revision" ? "Realisasi revisi" : "Realisasi"}</label>
                  <textarea
                    disabled
                    placeholder={employeeCanSubmit ? "Pegawai mengisi ringkasan realisasi di sini" : "Entry sudah dikirim / task sudah diproses"}
                  />
                </div>
                <div className="field">
                  <label>Upload evidence</label>
                  <input type="file" disabled />
                  <small className="muted">Preview field pegawai · PDF/JPG/PNG/WebP maks. 3 MB.</small>
                </div>
                <button className="btn" type="button" disabled>
                  {task.status === "revision" ? "Kirim Revisi" : "Submit Realisasi"}
                </button>
                <small className="muted">Dinonaktifkan di Admin Preview agar Admin tidak submit atas nama pegawai.</small>
              </div>
            </section>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="card empty">
          Belum ada task untuk {selectedEmployee?.full_name || "pegawai ini"} pada periode aktif. Buat task di Team Tasks agar alur entry dapat direview di sini.
        </div>
      ) : null}
    </>
  );
}
