import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { saveWeeklyCalibration } from "./actions";
import { SemesterPicker } from "./semester-picker";
import { SemesterTrendChart } from "./semester-trend-chart";

type Params = { tab?: string; page?: string; semester?: string; entry?: string; saved?: string; error?: string };
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
function semesterFromWeek(weekStart: string) {
  // Attribute the weekly reflection to its Thursday, not its Monday.
  // This handles weeks crossing June/July and December/January correctly.
  const thursday = new Date(weekStart.slice(0,10) + "T00:00:00Z");
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  return thursday.getUTCFullYear() + "-" + (thursday.getUTCMonth() < 6 ? "1" : "2");
}
function weightedIndex(row: any, calibrated = false) {
  return calibrated
    ? Number(row.calibration_performance) * .5 + Number(row.calibration_contribution) * .3 + Number(row.calibration_collaboration) * .2
    : Number(row.performance) * .5 + Number(row.contribution) * .3 + Number(row.collaboration) * .2;
}
function mean(values: number[]): number | null {
  return values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
}
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

export default async function WeeklyFeedbackPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (!["supervisor", "admin"].includes(profile.role)) return <p>Akses khusus atasan.</p>;
  const tab = params.tab === "calibration" ? "calibration" : "history";
  const pageSize = 8;
  const baseSelect = "id,employee_id,week_start,created_at,performance,contribution,collaboration,calibration_status,calibration_performance,calibration_contribution,calibration_collaboration,calibration_note,calibrated_at,employees(full_name)";
  let total = 0;
  let currentPage = 1;
  let totalPages = 1;
  let history: any[] = [];
  let allRows: any[] = [];
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const currentYear = wib.getUTCFullYear();
  const currentSemester = wib.getUTCMonth() < 6 ? 1 : 2;
  const parsedSemester = /^(\d{4})-(1|2)$/.exec(params.semester ?? "");
  const validYear = parsedSemester ? Number(parsedSemester[1]) : currentYear;
  const reportYear = validYear >= 2026 && validYear <= currentYear ? validYear : currentYear;
  const reportSemester = parsedSemester && validYear === reportYear ? Number(parsedSemester[2]) : currentSemester;
  const activeSemester = reportYear + "-" + reportSemester;
  const semesterLabel = "Semester " + (reportSemester === 1 ? "I" : "II") + " " + reportYear;
  const monthsLabel = reportSemester === 1 ? "Januari–Juni" : "Juli–Desember";
  const semesterStart = new Date(Date.UTC(reportYear, reportSemester === 1 ? 0 : 6, 1));
  const semesterEnd = new Date(Date.UTC(reportYear, reportSemester === 1 ? 6 : 12, 0));
  const semesterQueryStart = new Date(semesterStart);
  semesterQueryStart.setUTCDate(semesterQueryStart.getUTCDate() - 7);
  const semesterOptions: { value: string; label: string }[] = [];
  for (let year = currentYear; year >= 2026; year--) {
    semesterOptions.push({ value: year + "-2", label: "Semester II (Jul–Des) " + year });
    semesterOptions.push({ value: year + "-1", label: "Semester I (Jan–Jun) " + year });
  }

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
    // Fetch the whole selected semester; never silently cap accumulated weekly history.
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from("weekly_feedback").select(baseSelect)
        .gte("week_start", isoDate(semesterQueryStart))
        .lte("week_start", isoDate(semesterEnd))
        .order("week_start", { ascending:false })
        .order("created_at", { ascending:false })
        .range(offset, offset + 999);
      if (error) return <p className="notice">Data kalibrasi gagal dimuat. Silakan coba lagi.</p>;
      const batch = data ?? [];
      allRows.push(...batch);
      if (batch.length < 1000) break;
      offset += 1000;
    }
  }
  const semesterRows = allRows.filter((row) => semesterFromWeek(String(row.week_start)) === activeSemester);
  const calibratedRows = semesterRows.filter((row) =>
    row.calibration_status === "calibrated" && DIMENSIONS.every((dimension) => row[dimension.verified] !== null)
  );
  // Every Thursday in the semester is a weekly plotting position.
  // Missing weeks remain null so they are not interpreted as poor performance.
  const firstThursday = new Date(semesterStart);
  firstThursday.setUTCDate(firstThursday.getUTCDate() + ((4 - firstThursday.getUTCDay() + 7) % 7));
  const points: {weekStart:string;label:string;self:number|null;calibrated:number|null;submissions:number;calibrations:number}[] = [];
  const byWeek = new Map<string, any[]>();
  for (const row of semesterRows) {
    const key = String(row.week_start);
    const items = byWeek.get(key) ?? [];
    items.push(row);
    byWeek.set(key, items);
  }
  for (const day = new Date(firstThursday); day <= semesterEnd; day.setUTCDate(day.getUTCDate() + 7)) {
    const monday = new Date(day);
    monday.setUTCDate(monday.getUTCDate() - 3);
    const weekStart = isoDate(monday);
    const weekRows = byWeek.get(weekStart) ?? [];
    const verified = weekRows.filter((row) => row.calibration_status === "calibrated" && DIMENSIONS.every((dim) => row[dim.verified] !== null));
    points.push({
      weekStart,
      label: new Intl.DateTimeFormat("id-ID", {day:"2-digit",month:"short",timeZone:"UTC"}).format(day),
      self: mean(weekRows.map((row) => weightedIndex(row))),
      calibrated: mean(verified.map((row) => weightedIndex(row,true))),
      submissions: weekRows.length,
      calibrations: verified.length,
    });
  }
  const dimensions = DIMENSIONS.map((dim) => ({
    label: dim.name,
    self: avg(semesterRows,dim.self),
    calibrated: avg(calibratedRows,dim.verified),
  }));
  return (
    <div className="feedback-admin">
      <style>{"\n.feedback-admin{height:calc(100dvh - 44px);min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden}\n.feedback-admin .topbar{margin-bottom:2px}\n.fb-intro{display:flex;justify-content:space-between;align-items:center;gap:12px;flex:0 0 auto}\n.fb-intro small{font-size:10px;color:#667085}\n.fb-panel{border:1px solid #e0e5ef;border-radius:12px;background:#fff;padding:12px;min-width:0;min-height:0}\n.fb-panel h3{font-size:13px;margin:0 0 8px;color:#24307b}\n.fb-caption{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#667085}\n.fb-standalone{font-size:10px;color:#667085;line-height:1.45;margin-top:8px}\n.fb-table-panel{flex:1;min-height:0;overflow:auto}\n.fb-table-panel table{table-layout:fixed}\n.fb-table-panel th,.fb-table-panel td{font-size:11px;padding:9px 8px}\n.fb-table-panel td{white-space:normal;word-break:break-word}\n.fb-pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 2px;font-size:11px}\n.fb-pagination a{padding:6px 11px;border:1px solid #dce1ec;border-radius:8px;color:#2a3587;font-weight:700}\n.fb-flag{font-size:10px;border-radius:6px;background:#f0f3fb;padding:4px 6px;display:inline-block}\n.fb-empty{padding:24px;text-align:center;color:#667085;font-size:13px}\n.fb-semester-dashboard{display:grid;grid-template-rows:auto minmax(0,1fr) minmax(132px,.41fr);gap:9px;flex:1;min-height:0;overflow:hidden}\n.fb-period-row{display:flex;justify-content:space-between;align-items:center;gap:15px;min-height:36px}\n.fb-semester-picker{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;color:#24307b}\n.fb-semester-picker select{border:1px solid #cfd8e8;border-radius:9px;padding:8px 34px 8px 12px;color:#24307b;background:#fff;outline-offset:2px;font-weight:700;font-size:12px;min-width:232px;cursor:pointer}\n.fb-period-hint{font-size:11px;color:#667085}\n.fb-upper-layout{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(285px,.9fr);gap:10px;min-height:0}\n.fb-chart-main{display:flex;flex-direction:column;gap:8px;border:1px solid #d9e1f0;border-left:4px solid #2a3587;border-radius:13px;background:linear-gradient(180deg,#fbfcff 0%,#fff 35%);padding:13px 16px;min-width:0;min-height:0;overflow:hidden}\n.fb-chart-head{display:flex;justify-content:space-between;align-items:center;gap:10px}\n.fb-chart-kicker{letter-spacing:.1em;font-size:9px;color:#5b74a5;font-weight:800}\n.fb-chart-head h2{font-size:17px;color:#24307b;margin:2px 0 3px}\n.fb-chart-head p{font-size:10px;color:#667085;margin:0}\n.fb-chart-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:10px;color:#667085;white-space:nowrap}\n.fb-chart-meta strong{font-size:13px;color:#24307b}\n.fb-meta-divider{color:#b9c5db}\n.fb-chart-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:#475467}\n.fb-chart-legend span{display:inline-flex;align-items:center;gap:7px}\n.fb-legend-swatch{display:inline-block;width:21px;height:4px;border-radius:9px}\n.fb-legend-swatch.self{background:#75a9df}\n.fb-legend-swatch.verified{background:#28388e}\n.fb-chart-canvas{flex:1 1 auto;min-height:130px;min-width:0}\n.fb-chart-empty{flex:1;min-height:130px;display:flex;justify-content:center;align-items:center;flex-direction:column;gap:8px;text-align:center;color:#667085;background:repeating-linear-gradient(0deg,transparent 0,transparent 48px,#f3f5fa 49px,#f3f5fa 50px);border-radius:9px;padding:24px}\n.fb-chart-empty strong{font-size:14px;color:#344469}\n.fb-chart-empty span{font-size:11px;max-width:420px;line-height:1.5}\n.fb-dimension-section{flex:0 0 auto;border-top:1px solid #e6eaf3;padding-top:7px}\n.fb-dimension-title{font-size:11px;color:#24307b;font-weight:800;margin-bottom:7px}\n.fb-dimension-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}\n.fb-dimension-tile{border:1px solid #e5e9f3;border-radius:8px;padding:6px 8px;background:#fff;min-width:0}\n.fb-dimension-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:5px;font-size:10px;color:#24307b}\n.fb-dimension-top span{font-size:9px;color:#98a2b3}\n.fb-mini-row{display:grid;grid-template-columns:50px minmax(0,1fr) 30px;align-items:center;gap:5px;margin:3px 0;font-size:9px;color:#667085}\n.fb-mini-row strong{font-size:10px;color:#24307b;text-align:right}\n.fb-mini-track{height:7px;background:#edf0f8;border-radius:99px;overflow:hidden}\n.fb-mini-fill{height:100%;border-radius:99px}\n.fb-mini-fill.self{background:#75a9df}\n.fb-mini-fill.verified{background:#28388e}\n.fb-chart-footnote{flex:0 0 auto;color:#78849a;font-size:9px;line-height:1.32;margin:0}\n.fb-calibration-panel{overflow:auto}\n.fb-calibration-panel h3{position:sticky;top:-12px;background:#fff;padding:2px 0 8px;z-index:1}\n.fb-editor{display:grid;gap:8px}\n.fb-editor select,.fb-editor textarea{width:100%;background:#fff;border:1px solid #dce1ec;padding:7px 9px;border-radius:8px;font-size:12px}\n.fb-editor label{font-size:11px;font-weight:700;color:#24307b}\n.fb-editor textarea{resize:vertical;min-height:50px}\n.fb-editor-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n.fb-editor-row>div{min-width:0;display:grid;gap:4px}\n.fb-editor .btn{width:100%;padding:9px}\n.fb-note{padding:7px 9px;background:#f4f5ff;border-radius:8px;color:#42527f;font-size:11px;line-height:1.5}\n.fb-semester-history{display:flex;flex-direction:column;gap:4px;overflow:hidden;padding:8px 10px}\n.fb-semester-history-header{display:flex;justify-content:space-between;gap:12px;align-items:center}\n.fb-semester-history-header h3{margin:0}\n.fb-semester-history-header span{font-size:10px;color:#667085}\n.fb-table-scroll{flex:1;min-height:0;overflow:auto}\n.fb-list{width:100%;border-collapse:collapse;table-layout:fixed}\n.fb-list td,.fb-list th{font-size:11px;padding:7px 8px;line-height:1.2}\n.fb-list td{overflow:hidden;text-overflow:ellipsis}\n.fb-list a{font-weight:700;color:#2a3587}\n.fb-semester-history .fb-pagination{padding:2px 3px;font-size:10px}\n.fb-semester-history .fb-pagination a{padding:3px 8px;font-size:10px}\n@media(max-width:1050px){.fb-upper-layout{grid-template-columns:minmax(0,1.7fr) minmax(260px,1fr)}.fb-chart-meta{display:none}.fb-dimension-grid{gap:4px}.fb-mini-row{grid-template-columns:39px minmax(0,1fr) 28px;gap:3px}.fb-dimension-tile{padding:5px}}\n@media(max-width:750px){.feedback-admin{height:auto;min-height:calc(100dvh - 44px);overflow:visible}.fb-semester-dashboard{display:flex;flex-direction:column;overflow:visible}.fb-period-row{align-items:flex-start;flex-wrap:wrap}.fb-upper-layout{display:flex;flex-direction:column}.fb-chart-canvas{height:260px;flex:none}.fb-chart-main{overflow:visible}.fb-dimension-grid{grid-template-columns:1fr}.fb-calibration-panel,.fb-semester-history{overflow:visible}.fb-table-scroll{overflow:auto;max-height:290px}.fb-table-panel{overflow:auto}.fb-period-hint{font-size:10px}}\n\n.fb-history-table{table-layout:fixed;width:100%;min-width:760px}\n.fb-history-table th,.fb-history-table td{vertical-align:middle;padding:9px 7px;font-size:11px;line-height:1.3;white-space:normal;overflow-wrap:anywhere}\n.fb-row-sub{font-size:10px;color:#77839a;margin-top:3px}\n.fb-row-select{width:100%;max-width:100%;border:1px solid #cfd8e8;border-radius:8px;background:#fff;color:#24307b;padding:7px 5px;font-size:11px;min-height:34px}\n.fb-row-select:focus{outline:2px solid #b8c7ee;outline-offset:1px}\n.fb-inline-save{padding:8px 10px;min-height:34px;min-width:56px;width:100%;font-size:11px}\n.fb-save-success,.fb-save-error{font-size:11px;padding:9px;border-radius:8px;margin:4px 0 10px}\n.fb-save-success{background:#edf8f3;color:#067647}\n.fb-save-error{background:#fef3f2;color:#b42318}\n@media(max-width:900px){.fb-table-panel{overflow:auto}}\n\n/* Weekly Calibration is a dedicated large semester infographic without entry forms. */\n.fb-semester-dashboard{display:flex;flex-direction:column;gap:9px;min-height:0;flex:1;overflow:hidden}\n.fb-semester-dashboard > .fb-chart-main{flex:1 1 auto;min-height:0;width:100%}\n.fb-chart-canvas{flex:1 1 auto;min-height:170px}\n@media(max-width:750px){.fb-semester-dashboard{height:auto;overflow:visible}.fb-semester-dashboard > .fb-chart-main{min-height:560px}}\n"}</style>
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
            <div className="fb-caption" style={{marginBottom:9}}><strong>Total {total} pengisian</strong><span>Setiap feedback baru menjadi baris baru</span></div>
            {params.saved === "1" ? <p className="fb-save-success" role="status">Nilai kalibrasi berhasil disimpan. Data lengkap otomatis masuk grafik Weekly Calibration.</p> : null}
            {params.error ? <p className="fb-save-error" role="alert">
              {params.error === "conflict" ? "Data baru saja berubah. Muat ulang sebelum menyimpan lagi." : "Kalibrasi belum berhasil disimpan. Periksa dimensi dan nilai 1–5."}
            </p> : null}
            <table className="fb-history-table">
              <colgroup>
                <col style={{width:"19%"}}/><col style={{width:"11%"}}/><col style={{width:"13%"}}/>
                <col style={{width:"19%"}}/><col style={{width:"17%"}}/><col style={{width:"10%"}}/><col style={{width:"11%"}}/>
              </colgroup>
              <thead><tr><th>Pegawai / Pengisian</th><th>Minggu</th><th>Self P / C / K</th><th>Kalibrasi P / C / K</th><th>Dimensi</th><th>Nilai Atasan</th><th>Aksi</th></tr></thead>
              <tbody>
                {history.map((row) => {
                  const formId = "fb-save-" + row.id;
                  const completeCount = DIMENSIONS.filter((dim) => row[dim.verified] !== null).length;
                  const nextDimension = DIMENSIONS.find((dim) => row[dim.verified] === null)?.self ?? "performance";
                  return <tr key={row.id}>
                    <td><strong>{nameOf(row)}</strong><div className="fb-row-sub">{submissionTime(row.created_at)}</div></td>
                    <td>{dateLabel(row.week_start)}</td>
                    <td><strong>{row.performance} / {row.contribution} / {row.collaboration}</strong></td>
                    <td>
                      <strong>{[row.calibration_performance,row.calibration_contribution,row.calibration_collaboration]
                        .map((value) => value === null ? "—" : value).join(" / ")}</strong>
                      <div className="fb-row-sub">{completeCount === 3 ? "Terkalibrasi" : completeCount + "/3 dimensi tersimpan"}</div>
                    </td>
                    <td>
                      <form id={formId} action={saveWeeklyCalibration}>
                        <input type="hidden" name="id" value={row.id}/>
                        <input type="hidden" name="page" value={currentPage}/>
                        <select className="fb-row-select" aria-label={"Dimensi " + nameOf(row)} name="dimension" defaultValue={nextDimension} required>
                          {DIMENSIONS.map((dim) => <option key={dim.self} value={dim.self}>{dim.name}</option>)}
                        </select>
                      </form>
                    </td>
                    <td>
                      <select form={formId} className="fb-row-select" aria-label={"Nilai atasan " + nameOf(row)} name="score" defaultValue="" required>
                        <option value="" disabled>Nilai</option>
                        {[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} / 5</option>)}
                      </select>
                    </td>
                    <td><button type="submit" form={formId} className="btn fb-inline-save">Save</button></td>
                  </tr>;
                })}
                {!history.length ? <tr><td colSpan={7} className="fb-empty">Belum ada feedback. Pengisian baru staf otomatis menjadi baris di sini.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <div className="fb-pagination"><span>Halaman {currentPage} dari {totalPages}</span><div style={{display:"flex",gap:8}}>
            {currentPage > 1 ? <Link href={"/weekly-feedback?tab=history&page=" + (currentPage-1)}>← Sebelumnya</Link> : null}
            {currentPage < totalPages ? <Link href={"/weekly-feedback?tab=history&page=" + (currentPage+1)}>Berikutnya →</Link> : null}
          </div></div>
        </>
      ) : (
        <div className="fb-semester-dashboard">
          <div className="fb-period-row">
            <SemesterPicker selected={activeSemester} options={semesterOptions} />
            <span className="fb-period-hint">Akumulasi mingguan · {monthsLabel} {reportYear} · Feedback only</span>
          </div>
          <SemesterTrendChart
            points={points}
            dimensions={dimensions}
            semesterLabel={semesterLabel}
            totalEntries={semesterRows.length}
            totalCalibrated={calibratedRows.length}
          />
        </div>
      )}
    </div>
  );
}
