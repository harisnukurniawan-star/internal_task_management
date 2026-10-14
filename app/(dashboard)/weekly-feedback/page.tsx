import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { calibrateWeeklyFeedback } from "./actions";

type Params = { tab?: string; page?: string; week?: string; entry?: string; saved?: string; error?: string };
const DIMENSIONS = [
  { name: "Performance", self: "performance", verified: "calibration_performance" },
  { name: "Contribution", self: "contribution", verified: "calibration_contribution" },
  { name: "Collaboration", self: "collaboration", verified: "calibration_collaboration" },
] as const;
function nameOf(row: any) {
  const item = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  return String(item?.full_name ?? "Pegawai");
}
function avg(rows: any[], key: string): number | null {
  const nums = rows.map((r) => Number(r[key])).filter((n, i) => rows[i]?.[key] != null && Number.isFinite(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function num(n: number | null) { return n == null ? "—" : n.toFixed(2); }
function dateLabel(date: string) {
  const d = new Date(date.slice(0,10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? date : new Intl.DateTimeFormat("id-ID", { day:"2-digit",month:"short",year:"numeric",timeZone:"UTC" }).format(d);
}
function submissionTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", timeZone:"Asia/Jakarta" }).format(new Date(value)) + " WIB";
}
function calibrationLabel(status: string) {
  return status === "calibrated" ? "Terkalibrasi" : status === "insufficient" ? "Bukti belum cukup" : "Belum ditinjau";
}
function barWidth(value: number | null) {
  return String(Math.max(0, Math.min(100, (value ?? 0) / 5 * 100))) + "%";
}

export default async function WeeklyFeedbackPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["supervisor", "admin"].includes(profile.role)) return <p>Akses khusus atasan.</p>;
  const tab = params.tab === "calibration" ? "calibration" : "history";
  const pageSize = 9;
  const baseSelect = "id,employee_id,week_start,created_at,performance,contribution,collaboration,calibration_status,calibration_performance,calibration_contribution,calibration_collaboration,calibration_note,calibrated_at,employees(full_name)";
  let total = 0;
  let currentPage = 1;
  let totalPages = 1;
  let history: any[] = [];
  let allRows: any[] = [];

  if (tab === "history") {
    const { count, error: countError } = await supabase.from("weekly_feedback").select("id", { count:"exact", head:true });
    if (countError) return <p className="notice">Riwayat feedback belum tersedia. Pastikan migrasi database telah diterapkan.</p>;
    total = count ?? 0;
    totalPages = Math.max(1, Math.ceil(total / pageSize));
    const requestedPage = Number.parseInt(params.page ?? "1", 10);
    currentPage = Number.isFinite(requestedPage) ? Math.max(1, Math.min(requestedPage, totalPages)) : 1;
    const { data, error } = await supabase.from("weekly_feedback").select(baseSelect)
      .order("created_at", { ascending:false }).range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
    if (error) return <p className="notice">Riwayat feedback gagal dimuat.</p>;
    history = data ?? [];
  } else {
    const { data, error } = await supabase.from("weekly_feedback").select(baseSelect)
      .order("week_start", { ascending:false }).order("created_at", { ascending:false }).limit(500);
    if (error) return <p className="notice">Data kalibrasi gagal dimuat. Pastikan migrasi sudah diterapkan.</p>;
    allRows = data ?? [];
  }
  const availableWeeks = [...new Set(allRows.map((r) => String(r.week_start)))];
  const activeWeek = availableWeeks.includes(String(params.week ?? "")) ? String(params.week) : (availableWeeks[0] ?? "");
  const weekRows = allRows.filter((r) => r.week_start === activeWeek);
  const calibratedRows = weekRows.filter((r) => r.calibration_status === "calibrated" && DIMENSIONS.every((d) => r[d.verified] != null));
  const matchedSelf = calibratedRows.length ? calibratedRows.reduce((sum, row) => sum + (Number(row.performance)*.5 + Number(row.contribution)*.3 + Number(row.collaboration)*.2), 0) / calibratedRows.length : null;
  const calibratedIndex = calibratedRows.length ? calibratedRows.reduce((sum, row) => sum + (Number(row.calibration_performance)*.5 + Number(row.calibration_contribution)*.3 + Number(row.calibration_collaboration)*.2), 0) / calibratedRows.length : null;
  const difference = matchedSelf == null || calibratedIndex == null ? null : matchedSelf - calibratedIndex;
  const selected = weekRows.find((r) => r.id === params.entry) ?? weekRows.find((r) => r.calibration_status === "pending") ?? weekRows[0];
  // Read-only task context for a supervisor's feedback calibration (never mutates scoring).
  let evidenceSummary: { assigned: number; approved: number; submitted: number; revision: number } | null = null;
  if (selected && activeWeek) {
    const { data: period } = await supabase.from("weekly_periods").select("id")
      .eq("week_start", activeWeek).maybeSingle();
    if (period) {
      const { data: taskRows } = await supabase.from("tasks").select("id,status")
        .eq("period_id", period.id).eq("assigned_to", selected.employee_id);
      if (taskRows) {
        evidenceSummary = {
          assigned: taskRows.length,
          approved: taskRows.filter((t) => t.status === "approved").length,
          submitted: taskRows.filter((t) => t.status === "submitted").length,
          revision: taskRows.filter((t) => t.status === "revision").length,
        };
      }
    }
  }
  const chart = DIMENSIONS.map((d) => ({
    label:d.name, self:avg(calibratedRows,d.self), calibrated:avg(calibratedRows,d.verified)
  }));
  return (
    <div className="feedback-admin">
      <style>{".feedback-admin{height:calc(100dvh - 44px);min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden}.feedback-admin .topbar{margin-bottom:2px}.fb-intro{display:flex;justify-content:space-between;align-items:center;gap:12px}.fb-intro small{font-size:10px;color:#667085}.fb-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,1fr);gap:9px;min-height:0;flex:1}.fb-dashboard{min-height:0;flex:1;display:grid;grid-template-rows:auto minmax(0,1fr) minmax(125px,.55fr);gap:8px;overflow:hidden}.fb-panel{border:1px solid #e1e6f0;border-radius:12px;background:#fff;padding:12px;min-height:0;overflow:auto}.fb-panel h3{font-size:13px;margin:0 0 8px;color:#24307b}.fb-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fb-kpi{padding:10px 12px;background:#f7f8ff;border:1px solid #e1e6f0;border-radius:11px}.fb-kpi small{display:block;font-size:10px;color:#667085}.fb-kpi strong{font-size:20px;color:#24307b}.fb-kpi span{font-size:10px;color:#667085}.fb-bars{display:grid;gap:11px;margin-top:12px}.fb-dimension{display:grid;grid-template-columns:110px 1fr 38px;align-items:center;gap:10px}.fb-dimension label{font-size:12px;font-weight:700}.fb-track{height:9px;background:#edf0f8;border-radius:999px;overflow:hidden}.fb-fill{height:100%;border-radius:999px}.fb-self{background:#91b5e1}.fb-calibrated{background:#2a3587}.fb-caption{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#667085}.fb-key{display:inline-flex;align-items:center;gap:5px}.fb-dot{width:8px;height:8px;border-radius:2px;background:#91b5e1}.fb-dot.dark{background:#2a3587}.fb-standalone{font-size:10px;color:#667085;line-height:1.45;margin-top:8px}.fb-editor{display:grid;gap:8px}.fb-editor select,.fb-editor textarea{width:100%;background:#fff;border:1px solid #dce1ec;padding:7px 9px;border-radius:8px;font-size:12px}.fb-editor label{font-size:11px;font-weight:700;color:#24307b}.fb-editor textarea{resize:vertical;min-height:50px}.fb-editor-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fb-editor-row>div{min-width:0;display:grid;gap:4px}.fb-editor .btn{width:100%;padding:9px}.fb-note{padding:7px 9px;background:#f4f5ff;border-radius:8px;color:#42527f;font-size:11px}.fb-table-panel{flex:1;min-height:0;overflow:auto}.fb-table-panel table{table-layout:fixed}.fb-table-panel th,.fb-table-panel td{font-size:11px;padding:9px 8px}.fb-table-panel td{white-space:normal;word-break:break-word}.fb-pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 2px;font-size:11px}.fb-pagination a{padding:6px 11px;border:1px solid #dce1ec;border-radius:8px;color:#2a3587;font-weight:700}.fb-week{display:flex;gap:5px;overflow:auto;padding-bottom:3px;align-items:center}.fb-week a{white-space:nowrap;border:1px solid #dce1ec;padding:5px 8px;border-radius:8px;font-size:10px;color:#344054}.fb-week a.active{background:#2a3587;color:white}.fb-list{width:100%;border-collapse:collapse}.fb-list td,.fb-list th{font-size:11px;padding:7px 8px}.fb-list a{font-weight:700;color:#2a3587}.fb-flag{font-size:10px;border-radius:6px;background:#f0f3fb;padding:4px 6px;display:inline-block}.fb-empty{padding:24px;text-align:center;color:#667085;font-size:13px}@media(max-width:1050px){.fb-grid{grid-template-columns:minmax(0,1fr) minmax(260px,.9fr)}.fb-dimension{grid-template-columns:75px 1fr 33px}}@media(max-width:760px){.feedback-admin{height:auto;min-height:calc(100dvh - 44px);overflow:visible}.fb-dashboard{display:flex;flex-direction:column;overflow:visible}.fb-kpis{grid-template-columns:repeat(2,1fr)}.fb-grid{display:flex;flex-direction:column}.fb-panel{overflow:visible}.fb-table-panel{overflow:auto}}"} </style>
      <div className="fb-intro">
        <PageHeader title="Weekly Feedback" subtitle="Refleksi staf dan kalibrasi mingguan untuk coaching, bukan penilaian atau klasemen." />
        <small>Feedback only · Terpisah dari scoring</small>
      </div>
      <nav className="page-tabs" aria-label="Weekly feedback sections">
        <Link href="/weekly-feedback?tab=history&page=1" className={"page-tab " + (tab === "history" ? "active" : "")}>Riwayat Pengisian</Link>
        <Link href="/weekly-feedback?tab=calibration" className={"page-tab " + (tab === "calibration" ? "active" : "")}>Weekly Calibration</Link>
      </nav>
      {tab === "history" ? (
        <>
          <section className="fb-panel fb-table-panel">
            <div className="fb-caption" style={{marginBottom:9}}><strong>Total {total} pengisian</strong><span>Setiap pegawai maksimal sekali per minggu</span></div>
            <table>
              <thead><tr><th>Pegawai</th><th>Minggu</th><th>Diisi pada</th><th>Performance</th><th>Contribution</th><th>Collaboration</th><th>Kalibrasi</th></tr></thead>
              <tbody>
                {history.map((row) => <tr key={row.id}>
                  <td><strong>{nameOf(row)}</strong></td><td>{dateLabel(row.week_start)}</td><td>{submissionTime(row.created_at)}</td>
                  <td>{row.performance} / 5</td><td>{row.contribution} / 5</td><td>{row.collaboration} / 5</td>
                  <td><span className="fb-flag">{calibrationLabel(row.calibration_status)}</span></td>
                </tr>)}
                {!history.length ? <tr><td colSpan={7} className="fb-empty">Belum ada feedback yang masuk.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <div className="fb-pagination"><span>Halaman {currentPage} dari {totalPages}</span><div style={{display:"flex",gap:8}}>
            {currentPage > 1 ? <Link href={"/weekly-feedback?tab=history&page=" + (currentPage-1)}>← Sebelumnya</Link> : null}
            {currentPage < totalPages ? <Link href={"/weekly-feedback?tab=history&page=" + (currentPage+1)}>Berikutnya →</Link> : null}
          </div></div>
        </>
      ) : (
        <div className="fb-dashboard">
          <div className="fb-week">
            <strong style={{fontSize:11,marginRight:4}}>Minggu:</strong>
            {availableWeeks.slice(0,18).map((week) => (
              <Link key={week} className={week === activeWeek ? "active" : ""} href={"/weekly-feedback?tab=calibration&week=" + week}>{dateLabel(week)}</Link>
            ))}
            {!availableWeeks.length ? <span className="muted small">Belum ada pengisian</span> : null}
          </div>
          <div className="fb-kpis">
            <div className="fb-kpi"><small>Feedback masuk</small><strong>{weekRows.length}</strong><span>pegawai · minggu dipilih</span></div>
            <div className="fb-kpi"><small>Terkalibrasi</small><strong>{calibratedRows.length}</strong><span>validasi oleh atasan</span></div>
            <div className="fb-kpi"><small>Self · terkalibrasi</small><strong>{num(matchedSelf)}</strong><span>indeks persepsi / 5</span></div>
            <div className="fb-kpi"><small>Calibration / selisih</small><strong>{num(calibratedIndex)}</strong><span>gap {num(difference)} poin</span></div>
          </div>
          <div className="fb-grid">
            <section className="fb-panel">
              <h3>Perbandingan Persepsi vs Kalibrasi</h3>
              <div className="fb-caption"><span className="fb-key"><span className="fb-dot" /> Self-Assessment</span><span className="fb-key"><span className="fb-dot dark"/> Supervisor Calibration</span></div>
              {calibratedRows.length ? <div className="fb-bars">
                {chart.map((row) => <div key={row.label}>
                  <strong style={{fontSize:11}}>{row.label}</strong>
                  <div className="fb-dimension"><label>Persepsi</label><div className="fb-track"><div className="fb-fill fb-self" style={{width:barWidth(row.self)}} /></div><span style={{fontSize:11}}>{num(row.self)}</span></div>
                  <div className="fb-dimension"><label>Kalibrasi</label><div className="fb-track"><div className="fb-fill fb-calibrated" style={{width:barWidth(row.calibrated)}} /></div><span style={{fontSize:11}}>{num(row.calibrated)}</span></div>
                </div>)}
              </div> : <p className="fb-empty">Belum ada kalibrasi pada minggu ini. Grafik muncul setelah atasan memvalidasi feedback staf.</p>}
              <p className="fb-standalone">Perbandingan hanya untuk isian yang sudah dikalibrasi, agar populasi self dan supervisor setara. Indeks diagnostik menggunakan bobot 50% Performance, 30% Contribution, 20% Collaboration. Angka ini tidak masuk nilai tugas, KPI, atau klasemen.</p>
            </section>
            <section className="fb-panel">
              <h3>Kalibrasi Feedback Pegawai</h3>
              {!selected ? <p className="fb-empty">Belum ada feedback untuk ditinjau.</p> : (
                <form className="fb-editor" action={calibrateWeeklyFeedback}>
                  <input type="hidden" name="id" value={selected.id}/>
                  <input type="hidden" name="week_start" value={selected.week_start}/>
                  <div className="fb-note"><strong>{nameOf(selected)}</strong> · {dateLabel(selected.week_start)}<br/>Self: P {selected.performance} · C {selected.contribution} · K {selected.collaboration}</div>
                  <div className="fb-note">Eviden sistem (read-only): {evidenceSummary ? `${evidenceSummary.assigned} tugas · ${evidenceSummary.approved} approved · ${evidenceSummary.submitted} menunggu review · ${evidenceSummary.revision} revision` : "Belum ada data task untuk periode ini"}</div>
                  <div className="fb-editor-row">
                    {DIMENSIONS.slice(0,2).map((d) => <div key={d.name}>
                      <label htmlFor={"cal-" + d.name}>{d.name}</label>
                      <select id={"cal-" + d.name} name={d.self} defaultValue={selected[d.verified] ?? ""}>
                        <option value="">Pilih nilai</option>
                        {[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                      </select>
                    </div>)}
                  </div>
                  <div className="fb-editor-row">
                    <div><label htmlFor="cal-collaboration">Collaboration</label><select id="cal-collaboration" name="collaboration" defaultValue={selected.calibration_collaboration ?? ""}>
                      <option value="">Pilih nilai</option>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} / 5</option>)}
                    </select></div>
                    <div><label htmlFor="cal-status">Status</label><select id="cal-status" name="status" defaultValue={selected.calibration_status === "insufficient" ? "insufficient" : "calibrated"}>
                      <option value="calibrated">Terkalibrasi</option><option value="insufficient">Bukti belum cukup</option>
                    </select></div>
                  </div>
                  <label htmlFor="cal-note">Catatan coaching (opsional)</label>
                  <textarea id="cal-note" name="note" maxLength={500} defaultValue={selected.calibration_note ?? ""} placeholder="Konteks bukti, kontribusi, atau tindak lanjut..." />
                  {params.saved === "1" ? <div className="fb-note" role="status">Kalibrasi berhasil disimpan.</div> : null}
                  {params.error ? <div style={{fontSize:11,color:"#b42318"}} role="alert">Gagal menyimpan. Periksa kembali nilai dan coba lagi.</div> : null}
                  <button className="btn" type="submit">Simpan Kalibrasi</button>
                  <div className="fb-standalone" style={{margin:0}}>Gunakan eviden dan riwayat validasi tugas sebagai referensi. Belum cukup bukti bukan berarti nilai rendah.</div>
                </form>
              )}
            </section>
          </div>
          <section className="fb-panel" style={{padding:8}}>
            <h3>Feedback Pegawai · {activeWeek ? dateLabel(activeWeek) : "—"}</h3>
            <div style={{overflow:"auto",maxHeight:"100%"}}>
              <table className="fb-list"><thead><tr><th>Pegawai</th><th>Self P / C / K</th><th>Kalibrasi P / C / K</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
                {weekRows.map((row) => <tr key={row.id}>
                  <td>{nameOf(row)}</td><td>{row.performance} / {row.contribution} / {row.collaboration}</td>
                  <td>{row.calibration_status === "calibrated" ? [row.calibration_performance,row.calibration_contribution,row.calibration_collaboration].join(" / ") : "—"}</td>
                  <td>{calibrationLabel(row.calibration_status)}</td>
                  <td><Link href={"/weekly-feedback?tab=calibration&week=" + activeWeek + "&entry=" + row.id}>Tinjau</Link></td>
                </tr>)}
                {!weekRows.length ? <tr><td className="fb-empty" colSpan={5}>Belum ada pengisian.</td></tr> : null}
              </tbody></table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
