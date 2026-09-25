import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { QUALITY_OPTIONS, TIMELINESS_RULE, complexityLabel, qualityLabel } from "@/lib/scoring";
import { evaluateClaim } from "../actions";

type ReviewSearchParams = FlashParams & { page?: string; tab?: string };

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function decisionLabel(value?: string | null) {
  if (value === "approved") return "Approved";
  if (value === "revision") return "Revision";
  if (value === "rejected") return "Rejected";
  return "-";
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<ReviewSearchParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) return <p>Unauthorized</p>;

  const activeTab = params.tab === "evaluation" ? "evaluation" : "validation";

  const { data: claimRows } = await supabase
    .from("task_claims")
    .select("id,task_id,version,realization_summary,completion_percent,progress_status,employee_comment,submitted_at,tasks(title,status,complexity,due_at,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)),employees(full_name),task_evaluations(decision,quality,score,complexity_score,timeliness_score,quality_score,completion_score,feedback,evaluated_at),evidence_files(file_name,file_size,storage_path)")
    .order("submitted_at", { ascending: false });

  const allClaims = claimRows ?? [];
  const latestByTask = new Map<string, any>();
  for (const item of allClaims) if (!latestByTask.has(item.task_id)) latestByTask.set(item.task_id, item);

  const validationClaims = [...latestByTask.values()].filter((item) => !relationOne(item.task_evaluations));
  const completedClaims = allClaims.filter((item) => Boolean(relationOne(item.task_evaluations)));

  const requestedPage = Number.parseInt(params.page || "1", 10);

  let currentPage = 1;
  let claim: any = null;
  let evidenceRows: any[] = [];

  if (activeTab === "validation") {
    const totalPages = Math.max(1, validationClaims.length);
    currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
    claim = validationClaims[currentPage - 1] ?? null;

    const rawEvidence = (claim?.evidence_files ?? []).slice(0, 5);
    evidenceRows = await Promise.all(
      rawEvidence.map(async (file: any) => {
        const [viewSigned, downloadSigned] = await Promise.all([
          supabase.storage.from("task-evidence").createSignedUrl(file.storage_path, 300),
          supabase.storage.from("task-evidence").createSignedUrl(file.storage_path, 300, { download: file.file_name }),
        ]);
        return {
          ...file,
          viewUrl: viewSigned.data?.signedUrl || null,
          downloadUrl: downloadSigned.data?.signedUrl || null,
        };
      }),
    );
  }

  const evaluation = relationOne(claim?.task_evaluations);
  const kpi = relationOne(claim?.tasks?.employee_kpis);
  const tupoksi = relationOne(claim?.tasks?.employee_tupoksi);
  const progressLabel = claim?.progress_status === "lanjut_pekan_depan" ? "Lanjut pekan depan" : "Selesai";

  const historyPageSize = 10;
  const historyTotalPages = Math.max(1, Math.ceil(completedClaims.length / historyPageSize));
  const historyPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), historyTotalPages) : 1;
  const historyRows = completedClaims.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  return (
    <div style={{ height: "calc(100vh - 44px)", overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ flex: "0 0 auto" }}>
        <PageHeader title="Validation & Evaluation" subtitle="Review submission bawahan dan simpan riwayat evaluasi dalam satu halaman." />
        <FlashMessage params={params} />

        <div className="page-tabs" style={{ marginBottom: 8 }}>
          <a className={`page-tab ${activeTab === "validation" ? "active" : ""}`} href="/reviews?tab=validation&page=1">
            Validation ({validationClaims.length})
          </a>
          <a className={`page-tab ${activeTab === "evaluation" ? "active" : ""}`} href="/reviews?tab=evaluation&page=1">
            Evaluation Complete ({completedClaims.length})
          </a>
        </div>

        {activeTab === "validation" ? (
          <div className="notice neutral" style={{ marginBottom: 0, padding: "7px 10px" }}><strong>Ketepatan waktu:</strong> {TIMELINESS_RULE}</div>
        ) : null}
      </div>

      {activeTab === "validation" ? (
        validationClaims.length > 0 && claim ? (
          <section className="card compact" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", padding: 12, display: "flex", flexDirection: "column" }}>
            <div className="card-head" style={{ alignItems: "center", flex: "0 0 auto", paddingBottom: 9, borderBottom: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{claim.tasks?.title}</strong>
                  <StatusBadge status={claim.tasks?.status || "submitted"} />
                </div>
                <div className="task-meta" style={{ marginTop: 5 }}>
                  <span>{claim.employees?.full_name}</span>
                  <span>Submission v{claim.version}</span>
                  <span>Kompleksitas: {complexityLabel(claim.tasks?.complexity)}</span>
                  <span>Submit: {new Date(claim.submitted_at).toLocaleString("id-ID")}</span>
                  <span>Deadline: {claim.tasks?.due_at ? new Date(claim.tasks.due_at).toLocaleString("id-ID") : "Tidak ditetapkan"}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 7, alignItems: "center", flex: "0 0 auto" }}>
                {currentPage > 1 ? <a className="btn secondary" href={`/reviews?tab=validation&page=${currentPage - 1}`}>← Sebelumnya</a> : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>← Sebelumnya</span>}
                <span className="badge">{currentPage} / {validationClaims.length}</span>
                {currentPage < validationClaims.length ? <a className="btn secondary" href={`/reviews?tab=validation&page=${currentPage + 1}`}>Berikutnya →</a> : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>Berikutnya →</span>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.08fr) minmax(380px,.92fr)", gap: 14, flex: "1 1 auto", minHeight: 0, paddingTop: 10 }}>
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
                <div className="notice neutral" style={{ margin: 0, padding: "8px 10px" }}>
                  <strong>Support KPI</strong><br />
                  {kpi ? <><span>{kpi.kpi_code}</span><br /><span className="small">{kpi.kpi_description}</span></> : <span className="muted">Belum ditetapkan.</span>}
                </div>

                <div className="notice neutral" style={{ margin: 0, padding: "8px 10px" }}>
                  <strong>Support Tupoksi</strong><br />
                  {tupoksi ? <><span>{tupoksi.tupoksi_code}</span><br /><span className="small">{tupoksi.tupoksi_description}</span></> : <span className="muted">Belum ditetapkan.</span>}
                </div>

                <div className="submission-box" style={{ marginTop: 0, padding: 10 }}>
                  <strong>Realisasi Employee</strong>
                  <p style={{ margin: "6px 0 0" }}>{claim.realization_summary}</p>
                </div>

                <div className="notice neutral" style={{ margin: 0, padding: "9px 10px" }}>
                  <strong>Klaim Employee</strong>
                  <div className="task-meta" style={{ marginTop: 6 }}>
                    <span><strong>Realisasi:</strong> {Number(claim.completion_percent || 0).toFixed(0)}%</span>
                    <span><strong>Status:</strong> {progressLabel}</span>
                    <span><strong>Keterangan:</strong> {claim.employee_comment || "-"}</span>
                  </div>
                </div>

                <div style={{ flex: "1 1 auto", minHeight: 0, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "white", display: "flex", flexDirection: "column" }}>
                  <div style={{ background: "var(--blue-soft)", padding: "8px 10px", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
                    <strong>Evidence</strong>
                  </div>

                  <div style={{ flex: "1 1 auto", minHeight: 0, background: "white", overflowY: "auto" }}>
                    {evidenceRows.length > 0 ? (
                      evidenceRows.map((file: any, index: number) => (
                        <div key={`${file.storage_path}-${index}`} style={{ minHeight: 46, padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "white", borderBottom: index < evidenceRows.length - 1 ? "1px solid var(--line)" : "0" }}>
                          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="badge" style={{ flex: "0 0 auto" }}>#{index + 1}</span>
                            <div className="small" style={{ minWidth: 0 }}>
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{file.file_name}</div>
                              <div className="muted" style={{ marginTop: 2 }}>{formatBytes(file.file_size)} · Completion 100</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                            {file.viewUrl ? <a className="btn secondary" style={{ padding: "6px 9px" }} href={file.viewUrl} target="_blank" rel="noreferrer" aria-label={`View ${file.file_name}`}>👁 View</a> : null}
                            {file.downloadUrl ? <a className="btn" style={{ padding: "6px 9px" }} href={file.downloadUrl} target="_blank" rel="noreferrer">Download</a> : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="muted small" style={{ padding: "10px", background: "white" }}>Belum ada evidence · Completion 0</div>
                    )}
                  </div>
                </div>
              </div>

              <form action={evaluateClaim} className="form" style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", gap: 9 }}>
                <input type="hidden" name="claim_id" value={claim.id} />
                <input type="hidden" name="return_page" value={currentPage} />

                <div className="form-row" style={{ flex: "0 0 auto" }}>
                  <div className="field">
                    <label>Decision</label>
                    <select name="decision" defaultValue="approved">
                      <option value="approved">Approved</option>
                      <option value="revision">Revision</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Quality</label>
                    <select name="quality" defaultValue="sesuai_arahan">
                      {QUALITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.score}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field" style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <label>Feedback</label>
                  <textarea name="feedback" maxLength={1600} style={{ flex: "1 1 auto", minHeight: 100, resize: "none" }} />
                </div>

                <small className="muted" style={{ flex: "0 0 auto" }}>Skor final dihitung otomatis setelah evaluasi disimpan.</small>
                <button className="btn" type="submit" style={{ flex: "0 0 auto" }}>Simpan Evaluasi</button>
              </form>
            </div>
          </section>
        ) : (
          <div className="card empty" style={{ flex: "1 1 auto" }}>
            Tidak ada submission yang menunggu validasi. Submission baru dari bawahan akan otomatis muncul di tab ini.
          </div>
        )
      ) : (
        <section className="card compact" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="card-head" style={{ alignItems: "center", marginBottom: 10 }}>
            <div>
              <strong>Riwayat Evaluation Complete</strong>
              <div className="muted small" style={{ marginTop: 4 }}>Semua submission yang sudah dievaluasi tersimpan di sini, termasuk versi evaluasi sebelumnya.</div>
            </div>
            <span className="badge">{completedClaims.length} evaluasi</span>
          </div>

          <div className="table-wrap" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Employee</th>
                  <th>Submission</th>
                  <th>Support KPI</th>
                  <th>Decision</th>
                  <th>Quality</th>
                  <th>Final Score</th>
                  <th>Evaluated</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((item: any) => {
                  const itemEval = relationOne(item.task_evaluations);
                  const itemKpi = relationOne(item.tasks?.employee_kpis);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.tasks?.title}</strong></td>
                      <td>{item.employees?.full_name}</td>
                      <td>v{item.version}<div className="muted small">{new Date(item.submitted_at).toLocaleString("id-ID")}</div></td>
                      <td>{itemKpi ? <><span>{itemKpi.kpi_code}</span><div className="muted small clamp">{itemKpi.kpi_description}</div></> : <span className="muted">-</span>}</td>
                      <td><span className={`badge ${itemEval?.decision || ""}`}>{decisionLabel(itemEval?.decision)}</span></td>
                      <td>{qualityLabel(itemEval?.quality)}</td>
                      <td><strong>{Number(itemEval?.score || 0).toFixed(2)}</strong></td>
                      <td>{itemEval?.evaluated_at ? new Date(itemEval.evaluated_at).toLocaleString("id-ID") : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 10, flex: "0 0 auto" }}>
            {historyPage > 1 ? <a className="btn secondary" href={`/reviews?tab=evaluation&page=${historyPage - 1}`}>← Sebelumnya</a> : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>← Sebelumnya</span>}
            <span className="badge">{historyPage} / {historyTotalPages}</span>
            {historyPage < historyTotalPages ? <a className="btn secondary" href={`/reviews?tab=evaluation&page=${historyPage + 1}`}>Berikutnya →</a> : <span className="btn secondary" style={{ opacity: .4, cursor: "default" }}>Berikutnya →</span>}
          </div>
        </section>
      )}
    </div>
  );
}
