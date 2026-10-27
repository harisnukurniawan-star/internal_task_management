import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SELF_FEEDBACK_QUESTIONS, getPendingWeeklyFeedback } from "@/lib/weekly-feedback";
import type { createClient } from "@/lib/supabase/server";
import { submitWeeklySelfFeedback } from "./self-actions";

type Database = Awaited<ReturnType<typeof createClient>>;
type StaffParams = { page?: string; saved?: string; error?: string };

function dateLabel(value: string) {
  const parsed = new Date(value.slice(0, 10) + "T00:00:00Z");
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}
function submittedLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
  }).format(new Date(value)) + " WIB";
}

export async function StaffWeeklyFeedbackPage({
  supabase, profileId, params,
}: { supabase: Database; profileId: string; params: StaffParams }) {
  const { data: employee, error: employeeError } = await supabase.from("employees")
    .select("id").eq("profile_id", profileId).eq("active", true).maybeSingle();
  if (employeeError || !employee) return <p className="notice">Data pegawai belum dapat dimuat. Hubungi admin.</p>;

  let pendingWeek: string | null = null;
  let pendingError = false;
  try {
    pendingWeek = await getPendingWeeklyFeedback(supabase, employee.id);
  } catch {
    pendingError = true;
  }

  const pageSize = 8;
  const { count, error: countError } = await supabase.from("weekly_feedback")
    .select("id", { count: "exact", head: true }).eq("employee_id", employee.id);
  if (countError) return <p className="notice">Riwayat self-assessment belum dapat dimuat.</p>;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(requested) ? Math.max(1, Math.min(requested, totalPages)) : 1;
  // Staff only fetch their own three self-assessment values; calibration fields
  // and supervisor charts are never queried or rendered on this page.
  const { data: history, error: historyError } = await supabase.from("weekly_feedback")
    .select("id,week_start,created_at,performance,contribution,collaboration")
    .eq("employee_id", employee.id)
    .order("week_start", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (historyError) return <p className="notice">Riwayat self-assessment gagal dimuat.</p>;

  const feedbackErrors: Record<string, string> = {
    invalid: "Lengkapi ketiga penilaian dengan skala 1–5.",
    employee: "Akun tidak terhubung dengan pegawai aktif.",
    load: "Status feedback gagal diperiksa. Silakan ulangi.",
    period: "Periode pengisian sudah berubah atau feedback telah dikirim. Muat ulang halaman.",
    save: "Feedback belum tersimpan. Silakan coba kembali.",
  };
  return (
    <div style={{ height: "calc(100dvh - 44px)", display: "flex", flexDirection: "column", gap: 9, minHeight: 0, overflow: "hidden" }}>
      <PageHeader title="Weekly Feedback" subtitle="Self-assessment mingguan dan riwayat pengisian Anda." />
      {params.saved === "1" ? (
        <div className="notice" role="status" style={{ background: "#edf8f3", color: "#067647" }}>
          ✅ Feedback berhasil dikirim. Reminder untuk periode tersebut sudah dinonaktifkan.
        </div>
      ) : null}
      {params.error ? <div className="notice" role="alert" style={{ background: "#fef3f2", color: "#b42318" }}>
        {feedbackErrors[params.error] || "Terjadi masalah saat menyimpan feedback."}
      </div> : null}
      {pendingError ? <p className="notice" role="alert">Status kewajiban feedback belum dapat diperiksa. Muat ulang halaman.</p> : null}

      {pendingWeek && !pendingError ? (
        <section className="card compact" style={{ flex: "0 0 auto", padding: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
            <strong style={{ color: "var(--navy)", fontSize: 16 }}>Form Self-Assessment</strong>
            <span className="badge">Wajib · Minggu {dateLabel(pendingWeek)}</span>
          </div>
          <p className="muted small" style={{ margin: "0 0 10px" }}>
            Berikan penilaian 1–5 untuk kegiatan minggu ini. Setelah dikirim, jawaban masuk riwayat dan tidak bisa diubah.
          </p>
          <form action={submitWeeklySelfFeedback}>
            <input type="hidden" name="week_start" value={pendingWeek} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
              {SELF_FEEDBACK_QUESTIONS.map((question) => (
                <fieldset key={question.key} style={{ minWidth: 0, padding: 10, border: "1px solid var(--line)", borderRadius: 10 }}>
                  <legend style={{ fontWeight: 800, fontSize: 13, color: "var(--navy)", padding: "0 4px" }}>{question.label}</legend>
                  <p style={{ fontSize: 12, lineHeight: 1.5, minHeight: 54, margin: "5px 0 10px" }}>{question.statement}</p>
                  <div style={{ display: "flex", justifyContent: "space-around", gap: 5 }}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <label key={score} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer" }}>
                        <input type="radio" name={question.key} value={score} required style={{ accentColor: "#2a3587" }} />
                        {score}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button type="submit" className="btn">Submit Self-Assessment</button>
            </div>
          </form>
        </section>
      ) : !pendingError ? (
        <div className="notice neutral" style={{ flex: "0 0 auto" }}>
          Tidak ada kewajiban feedback yang aktif. Form tersedia Rabu–Jumat setelah ada submission task minggu berjalan,
          atau Senin–Rabu berikutnya untuk minggu sebelumnya yang belum diisi.
        </div>
      ) : null}

      <section className="card compact" style={{ flex: "1 1 auto", minHeight: 0, padding: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 9 }}>
          <strong style={{ color: "var(--navy)", fontSize: 16 }}>Riwayat Self-Assessment</strong>
          <span className="badge">{total} pengisian</span>
        </div>
        <div className="table-wrap" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
          <table>
            <thead><tr><th>Minggu</th><th>Diisi pada</th><th>Performance</th><th>Contribution</th><th>Collaboration</th></tr></thead>
            <tbody>
              {(history ?? []).map((row) => (
                <tr key={row.id}>
                  <td><strong>{dateLabel(row.week_start)}</strong></td>
                  <td>{submittedLabel(row.created_at)}</td>
                  <td>{row.performance} / 5</td><td>{row.contribution} / 5</td><td>{row.collaboration} / 5</td>
                </tr>
              ))}
              {!history?.length ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 24 }} className="muted">
                Belum ada riwayat self-assessment.
              </td></tr> : null}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 9, gap: 8 }}>
          {page > 1 ? <Link className="btn secondary" href={"/weekly-feedback?page=" + (page - 1)}>← Sebelumnya</Link> : <span />}
          <span className="badge">{page} / {totalPages}</span>
          {page < totalPages ? <Link className="btn secondary" href={"/weekly-feedback?page=" + (page + 1)}>Berikutnya →</Link> : <span />}
        </div>
      </section>
    </div>
  );
}
