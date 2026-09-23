import { FlashMessage, type FlashParams } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { QUALITY_OPTIONS, TIMELINESS_RULE, complexityLabel, qualityLabel } from "@/lib/scoring";
import { evaluateClaim } from "../actions";

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) return <p>Unauthorized</p>;

  const { data: claimRows } = await supabase
    .from("task_claims")
    .select("id,task_id,version,realization_summary,submitted_at,tasks(title,status,complexity,due_at,employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description),employee_tupoksi!tasks_support_tupoksi_employee_fkey(tupoksi_code,tupoksi_description)),employees(full_name),task_evaluations(decision,quality,score,complexity_score,timeliness_score,quality_score,completion_score,feedback),evidence_files(file_name,file_size,storage_path)")
    .order("submitted_at", { ascending: false });

  const latestByTask = new Map<string, any>();
  for (const claim of claimRows ?? []) if (!latestByTask.has(claim.task_id)) latestByTask.set(claim.task_id, claim);
  const claims = [...latestByTask.values()];

  const evidenceLinks = new Map<string, string>();
  for (const claim of claims) {
    const evidence = claim.evidence_files?.[0];
    if (!evidence) continue;
    const signed = await supabase.storage.from("task-evidence").createSignedUrl(evidence.storage_path, 300, { download: evidence.file_name });
    if (signed.data?.signedUrl) evidenceLinks.set(claim.id, signed.data.signedUrl);
  }

  return (
    <>
      <PageHeader title="Validation & Evaluation" subtitle="Nilai aktivitas dihitung otomatis dari Kompleksitas, Ketepatan Waktu, Quality, dan Completion evidence." />
      <FlashMessage params={params} />
      <div className="notice neutral"><strong>Ketepatan waktu:</strong> {TIMELINESS_RULE}</div>

      <div className="grid-2 section-sm">
        {claims.map((claim) => {
          const evaluation = claim.task_evaluations;
          const hasEvidence = Boolean(evidenceLinks.get(claim.id));
          const kpi = relationOne(claim.tasks?.employee_kpis);
          const tupoksi = relationOne(claim.tasks?.employee_tupoksi);
          return (
            <section className="card compact" key={claim.id}>
              <div className="card-head"><strong>{claim.tasks?.title}</strong><StatusBadge status={claim.tasks?.status || "submitted"} /></div>
              <div className="task-meta"><span>{claim.employees?.full_name}</span><span>Submission v{claim.version}</span><span>Kompleksitas: {complexityLabel(claim.tasks?.complexity)}</span></div>
              <div className="task-meta"><span>Submit: {new Date(claim.submitted_at).toLocaleString("id-ID")}</span><span>Deadline: {claim.tasks?.due_at ? new Date(claim.tasks.due_at).toLocaleString("id-ID") : "Tidak ditetapkan"}</span></div>
              <div className="notice neutral section-sm"><strong>Support KPI</strong><br />{kpi ? <><span>{kpi.kpi_code}</span><br /><span className="small">{kpi.kpi_description}</span></> : <span className="muted">Belum ditetapkan.</span>}</div>
              <div className="notice neutral section-sm"><strong>Support Tupoksi</strong><br />{tupoksi ? <><span>{tupoksi.tupoksi_code}</span><br /><span className="small">{tupoksi.tupoksi_description}</span></> : <span className="muted">Belum ditetapkan.</span>}</div>
              <p>{claim.realization_summary}</p>

              {hasEvidence ? <a className="evidence-link" href={evidenceLinks.get(claim.id)} target="_blank" rel="noreferrer">Buka evidence · Completion 100</a> : <p className="muted small">Tidak ada evidence file · Completion 0.</p>}

              {evaluation ? (
                <div className={`feedback ${evaluation.decision}`}>
                  <strong>Skor aktivitas: {Number(evaluation.score).toFixed(2)}</strong>
                  <span>Kompleksitas: {Number(evaluation.complexity_score).toFixed(1)}</span>
                  <span>Ketepatan waktu: {Number(evaluation.timeliness_score).toFixed(1)}</span>
                  <span>Quality: {qualityLabel(evaluation.quality)} · {Number(evaluation.quality_score).toFixed(1)}</span>
                  <span>Completion: {Number(evaluation.completion_score).toFixed(1)}</span>
                </div>
              ) : null}

              <form action={evaluateClaim} className="form section-sm">
                <input type="hidden" name="claim_id" value={claim.id} />
                <div className="form-row">
                  <div className="field"><label>Decision</label><select name="decision" defaultValue={evaluation?.decision || "approved"}><option value="approved">Approved</option><option value="revision">Revision</option><option value="rejected">Rejected</option></select></div>
                  <div className="field"><label>Quality</label><select name="quality" defaultValue={evaluation?.quality || "sesuai_arahan"}>{QUALITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.score}</option>)}</select></div>
                </div>
                <div className="field"><label>Feedback</label><textarea name="feedback" maxLength={1600} defaultValue={evaluation?.feedback || ""} /></div>
                <small className="muted">Skor final dihitung otomatis setelah evaluasi disimpan.</small>
                <button className="btn" type="submit">Simpan Evaluasi</button>
              </form>
            </section>
          );
        })}
      </div>
      {claims.length === 0 ? <div className="card empty">Belum ada submission untuk direview.</div> : null}
    </>
  );
}
