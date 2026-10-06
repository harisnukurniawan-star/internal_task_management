import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod, getEmployeeForProfile } from "@/lib/data";

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function semesterFromDate(dateText: string) {
  const [yearText, monthText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const semester = month <= 6 ? 1 : 2;
  return {
    year,
    semester,
    start: `${year}-${semester === 1 ? "01-01" : "07-01"}`,
    end: `${year}-${semester === 1 ? "06-30" : "12-31"}`,
    label: `Semester ${semester === 1 ? "I" : "II"} ${year}`,
  };
}

function latestClaim(task: any) {
  const claims = Array.isArray(task.task_claims) ? task.task_claims : [];
  return [...claims].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] ?? null;
}

function taskDecision(task: any) {
  const claim = latestClaim(task);
  const evaluation = relationOne(claim?.task_evaluations);
  return evaluation?.decision ?? null;
}

function scoreFromTask(task: any, field: "quality_score" | "timeliness_score" | "completion_score") {
  const claim = latestClaim(task);
  const evaluation = relationOne(claim?.task_evaluations);
  if (!evaluation || evaluation.decision !== "approved") return null;
  const value = Number(evaluation[field]);
  return Number.isFinite(value) ? value : null;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function pct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Number(value.toFixed(1))}%`;
}

function relationLabel(task: any) {
  const kpi = relationOne(task.employee_kpis);
  return {
    code: String(kpi?.kpi_code || "Tanpa KPI"),
    description: String(kpi?.kpi_description || "Belum ditautkan"),
  };
}

function employeeName(task: any) {
  const employee = relationOne(task.employees);
  return String(employee?.full_name || "Unknown");
}

function periodShortLabel(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateText;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(110, value));
}

function linePoints(values: number[], width = 620, height = 170) {
  if (values.length === 0) return "";
  const left = 34;
  const right = 14;
  const top = 14;
  const bottom = 28;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? left + usableWidth / 2 : left + (index / (values.length - 1)) * usableWidth;
      const y = top + usableHeight - (clampScore(value) / 110) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const supervisor = profile.role === "supervisor" || profile.role === "admin";
  const employee = supervisor ? null : await getEmployeeForProfile(profile.id, supabase);

  const currentPeriod = await getCurrentPeriod(supabase);
  const referenceDate = currentPeriod?.week_start ?? new Date().toISOString().slice(0, 10);
  const semester = semesterFromDate(referenceDate);
  const today = new Date().toISOString().slice(0, 10);

  const { data: periodRows } = await supabase
    .from("weekly_periods")
    .select("id,label,week_start,week_end,status")
    .gte("week_start", semester.start)
    .lte("week_start", semester.end)
    .order("week_start", { ascending: true });

  const periods = periodRows ?? [];
  const periodIds = periods.map((item: any) => item.id);
  const periodMap = new Map(periods.map((item: any) => [item.id, item]));

  let tasks: any[] = [];
  if (periodIds.length > 0 && (supervisor || employee?.id)) {
    let taskQuery = supabase
      .from("tasks")
      .select("id,period_id,title,status,assigned_to,support_kpi_id,due_at,complexity,employees!tasks_assigned_to_fkey(full_name),employee_kpis!tasks_support_kpi_employee_fkey(kpi_code,kpi_description),task_claims(id,version,submitted_at,task_evaluations(decision,quality_score,timeliness_score,completion_score,evaluated_at))")
      .in("period_id", periodIds);

    if (!supervisor && employee?.id) {
      taskQuery = taskQuery.eq("assigned_to", employee.id);
    }

    const { data } = await taskQuery;
    tasks = data ?? [];
  }

  const approvedTasks = tasks.filter((task) => taskDecision(task) === "approved");
  const revisionTasks = tasks.filter((task) => taskDecision(task) === "revision");
  const rejectedTasks = tasks.filter((task) => taskDecision(task) === "rejected");
  const waitingValidationTasks = tasks.filter((task) => {
    const claim = latestClaim(task);
    return Boolean(claim) && !relationOne(claim?.task_evaluations);
  });
  const openTasks = tasks.filter((task) => !latestClaim(task));

  const carryOverTasks = tasks.filter((task) => {
    const period = periodMap.get(task.period_id) as any;
    if (!period || String(period.week_end || "") >= today) return false;
    const decision = taskDecision(task);
    return decision !== "approved" && decision !== "rejected";
  });

  const completionRate = tasks.length > 0 ? (approvedTasks.length / tasks.length) * 100 : 0;
  const avgQuality = average(approvedTasks.map((task) => scoreFromTask(task, "quality_score")));
  const avgTimeliness = average(approvedTasks.map((task) => scoreFromTask(task, "timeliness_score")));

  const weekly = periods.map((period: any) => {
    const rows = tasks.filter((task) => task.period_id === period.id);
    const approved = rows.filter((task) => taskDecision(task) === "approved");
    const completion = rows.length > 0 ? (approved.length / rows.length) * 100 : 0;
    return {
      id: period.id,
      label: periodShortLabel(period.week_start),
      completion,
      quality: average(approved.map((task) => scoreFromTask(task, "quality_score"))) ?? 0,
      timeliness: average(approved.map((task) => scoreFromTask(task, "timeliness_score"))) ?? 0,
      total: rows.length,
    };
  }).filter((item: any) => item.total > 0 || String((periodMap.get(item.id) as any)?.week_start || "") <= today);

  const trendCompletion = weekly.map((item: any) => item.completion);
  const trendQuality = weekly.map((item: any) => item.quality);
  const trendTimeliness = weekly.map((item: any) => item.timeliness);

  const statusItems = [
    { key: "approved", label: "Approved", value: approvedTasks.length, tone: "#16a34a" },
    { key: "waiting", label: "Waiting Validation", value: waitingValidationTasks.length, tone: "#2563eb" },
    { key: "revision", label: "Revision", value: revisionTasks.length, tone: "#f59e0b" },
    { key: "open", label: "Open", value: openTasks.length, tone: "#64748b" },
    { key: "rejected", label: "Rejected", value: rejectedTasks.length, tone: "#dc2626" },
  ];
  const statusTotal = statusItems.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const donutStops: string[] = [];
  for (const item of statusItems) {
    const start = statusTotal > 0 ? (cursor / statusTotal) * 100 : 0;
    cursor += item.value;
    const end = statusTotal > 0 ? (cursor / statusTotal) * 100 : 0;
    donutStops.push(`${item.tone} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
  }
  const donutBackground = statusTotal > 0
    ? `conic-gradient(${donutStops.join(",")})`
    : "conic-gradient(#e5e7eb 0 100%)";

  const carryOverByEmployee = new Map<string, { count: number; oldestWeeks: number }>();
  for (const task of carryOverTasks) {
    const period = periodMap.get(task.period_id) as any;
    const diffMs = Math.max(0, new Date(`${today}T00:00:00Z`).getTime() - new Date(`${period.week_end}T00:00:00Z`).getTime());
    const ageWeeks = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
    const name = employeeName(task);
    const existing = carryOverByEmployee.get(name) ?? { count: 0, oldestWeeks: 0 };
    existing.count += 1;
    existing.oldestWeeks = Math.max(existing.oldestWeeks, ageWeeks);
    carryOverByEmployee.set(name, existing);
  }
  const carryOverRows = [...carryOverByEmployee.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.count - a.count || b.oldestWeeks - a.oldestWeeks)
    .slice(0, 5);

  const kpiMap = new Map<string, { code: string; description: string; approved: number; completionValues: number[] }>();
  for (const task of approvedTasks) {
    if (!task.support_kpi_id) continue;
    const label = relationLabel(task);
    const existing = kpiMap.get(task.support_kpi_id) ?? {
      code: label.code,
      description: label.description,
      approved: 0,
      completionValues: [],
    };
    existing.approved += 1;
    const completion = scoreFromTask(task, "completion_score");
    if (completion != null) existing.completionValues.push(completion);
    kpiMap.set(task.support_kpi_id, existing);
  }
  const kpiRows = [...kpiMap.values()]
    .map((item) => ({
      ...item,
      avgCompletion: item.completionValues.length
        ? item.completionValues.reduce((sum, value) => sum + value, 0) / item.completionValues.length
        : 0,
    }))
    .sort((a, b) => b.approved - a.approved || b.avgCompletion - a.avgCompletion)
    .slice(0, 5);
  const maxKpiApproved = Math.max(1, ...kpiRows.map((item) => item.approved));

  return (
    <div className="semester-dashboard">
      <style>{`
        .semester-dashboard{height:calc(100vh - 44px);min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1.15fr) minmax(0,.85fr);gap:8px;overflow:hidden}
        .sd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;min-height:0}
        .sd-title{font-size:20px;font-weight:800;color:#1f2b7b;line-height:1.08}
        .sd-sub{margin-top:2px;font-size:11px;color:#667085}
        .sd-badge{padding:6px 9px;border:1px solid #d8deea;border-radius:9px;background:#fff;font-size:10px;font-weight:700;color:#344054}
        .sd-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;min-height:0}
        .sd-card{border:1px solid #e2e7f0;background:#fff;border-radius:11px;padding:8px 10px;min-width:0;box-shadow:0 1px 2px rgba(16,24,40,.03)}
        .sd-card-label{font-size:9px;color:#667085;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sd-card-value{font-size:21px;font-weight:800;color:#17226f;margin-top:3px;line-height:1}
        .sd-card-note{font-size:8px;color:#98a2b3;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sd-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.9fr);gap:8px;min-height:0;overflow:hidden}
        .sd-grid.bottom{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
        .sd-panel{border:1px solid #e2e7f0;background:#fff;border-radius:11px;padding:8px 10px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column}
        .sd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;flex:0 0 auto}
        .sd-panel-title{font-size:12px;font-weight:800;color:#18206f;line-height:1.1}
        .sd-panel-note{font-size:8px;color:#98a2b3;white-space:nowrap}
        .sd-trend{flex:1 1 auto;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:2px}
        .sd-trend svg{width:100%;height:100%;min-height:110px;display:block}
        .sd-legend{display:flex;gap:13px;align-items:center;font-size:8px;color:#667085}
        .sd-key{display:inline-flex;align-items:center;gap:4px}
        .sd-dot{width:7px;height:7px;border-radius:999px}
        .sd-week-labels{display:grid;grid-template-columns:repeat(var(--weeks),1fr);gap:2px;font-size:7px;color:#98a2b3;text-align:center;margin:0 14px 0 34px}
        .sd-status-wrap{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:126px 1fr;gap:10px;align-items:center}
        .sd-donut{width:110px;height:110px;border-radius:999px;display:grid;place-items:center;position:relative;margin:auto}
        .sd-donut:after{content:"";position:absolute;width:70px;height:70px;background:#fff;border-radius:999px}
        .sd-donut-center{position:relative;z-index:1;text-align:center}
        .sd-donut-total{font-size:20px;font-weight:800;color:#17226f}
        .sd-donut-label{font-size:8px;color:#98a2b3}
        .sd-status-list{display:grid;gap:5px}
        .sd-status-item{display:grid;grid-template-columns:7px 1fr auto;gap:6px;align-items:center;font-size:8px;color:#475467}
        .sd-status-item strong{font-size:10px;color:#111827}
        .sd-kpi-list{flex:1 1 auto;min-height:0;display:grid;gap:4px;align-content:space-between}
        .sd-kpi-row{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(120px,1fr) 60px;gap:8px;align-items:center;min-height:0}
        .sd-kpi-name{min-width:0}
        .sd-kpi-code{font-size:9px;font-weight:800;color:#17226f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sd-kpi-desc{font-size:8px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
        .sd-bar-track{height:7px;border-radius:999px;background:#eef2f7;overflow:hidden}
        .sd-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#25368f,#10a6ca)}
        .sd-kpi-metric{text-align:right;font-size:8px;color:#667085;line-height:1.1}
        .sd-kpi-metric strong{display:block;font-size:10px;color:#111827}
        .sd-carry-table{width:100%;border-collapse:collapse;table-layout:fixed}
        .sd-carry-table th,.sd-carry-table td{padding:5px 5px;border-bottom:1px solid #edf1f6;font-size:8px;text-align:left}
        .sd-carry-table th{color:#667085;font-weight:700}
        .sd-carry-name{font-size:9px;font-weight:700;color:#111827}
        .sd-age{display:inline-flex;padding:2px 5px;border-radius:999px;background:#fff7ed;color:#b45309;font-weight:700}
        .sd-age.high{background:#fef2f2;color:#b42318}
        .sd-empty{display:grid;place-items:center;flex:1 1 auto;min-height:0;color:#98a2b3;font-size:9px;text-align:center}
        @supports selector(:has(*)){
          .main:has(.semester-dashboard){height:100vh;overflow:hidden;padding-top:12px;padding-bottom:12px}
          .main:has(.semester-dashboard) .semester-dashboard{height:calc(100vh - 24px)}
        }
        @media(max-width:1180px){
          .sd-cards{grid-template-columns:repeat(3,minmax(0,1fr))}
          .main:has(.semester-dashboard){height:auto;overflow:visible;padding-top:22px;padding-bottom:22px}
          .semester-dashboard,.main:has(.semester-dashboard) .semester-dashboard{height:auto;overflow:visible;display:flex;flex-direction:column}
          .sd-grid,.sd-grid.bottom{grid-template-columns:1fr}
          .sd-trend{min-height:190px}
        }
      `}</style>

      <div className="sd-head">
        <div>
          <div className="sd-title">Semester Performance Dashboard</div>
          <div className="sd-sub">
            {semester.label} · {supervisor ? "seluruh periode tim dalam semester yang sama" : "seluruh periode saya dalam semester yang sama"}
          </div>
        </div>
        <div className="sd-badge">
          {supervisor ? `${periods.length} periode · update dari task & validation` : `${employee?.full_name || "Staff"} · ${periods.length} periode`}
        </div>
      </div>

      <section className="sd-cards">
        <div className="sd-card">
          <div className="sd-card-label">Total Task</div>
          <div className="sd-card-value">{tasks.length}</div>
          <div className="sd-card-note">Seluruh task semester</div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">Approved</div>
          <div className="sd-card-value">{approvedTasks.length}</div>
          <div className="sd-card-note">Sudah tervalidasi</div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">Open / Carry Over</div>
          <div className="sd-card-value">{carryOverTasks.length}</div>
          <div className="sd-card-note">Belum closed dari periode lalu</div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">Completion Rate</div>
          <div className="sd-card-value">{pct(completionRate)}</div>
          <div className="sd-card-note">Approved ÷ seluruh task</div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">Avg Quality</div>
          <div className="sd-card-value">{pct(avgQuality)}</div>
          <div className="sd-card-note">Rata-rata task Approved</div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">Avg Ketepatan Waktu</div>
          <div className="sd-card-value">{pct(avgTimeliness)}</div>
          <div className="sd-card-note">Rata-rata hasil Validation</div>
        </div>
      </section>

      <section className="sd-grid">
        <div className="sd-panel">
          <div className="sd-panel-head">
            <div className="sd-panel-title">Tren Kinerja Mingguan</div>
            <div className="sd-panel-note">Completion · Quality · Ketepatan Waktu</div>
          </div>
          {weekly.length > 0 ? (
            <div className="sd-trend">
              <svg viewBox="0 0 620 170" role="img" aria-label="Tren kinerja mingguan">
                <line x1="34" y1="14" x2="34" y2="142" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="34" y1="142" x2="606" y2="142" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="34" y1="84" x2="606" y2="84" stroke="#eef2f7" strokeWidth="1" strokeDasharray="4 4" />
                <text x="4" y="19" fontSize="9" fill="#98a2b3">110</text>
                <text x="10" y="88" fontSize="9" fill="#98a2b3">50</text>
                <text x="16" y="145" fontSize="9" fill="#98a2b3">0</text>
                <polyline fill="none" stroke="#25368f" strokeWidth="2.5" points={linePoints(trendCompletion)} />
                <polyline fill="none" stroke="#10a6ca" strokeWidth="2.5" points={linePoints(trendQuality)} />
                <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points={linePoints(trendTimeliness)} />
              </svg>
              <div>
                <div className="sd-week-labels" style={{ ["--weeks" as any]: weekly.length }}>
                  {weekly.map((item: any) => <span key={item.id}>{item.label}</span>)}
                </div>
                <div className="sd-legend">
                  <span className="sd-key"><span className="sd-dot" style={{ background: "#25368f" }} />Completion</span>
                  <span className="sd-key"><span className="sd-dot" style={{ background: "#10a6ca" }} />Quality</span>
                  <span className="sd-key"><span className="sd-dot" style={{ background: "#f59e0b" }} />Ketepatan Waktu</span>
                </div>
              </div>
            </div>
          ) : <div className="sd-empty">Belum ada data periode semester.</div>}
        </div>

        <div className="sd-panel">
          <div className="sd-panel-head">
            <div className="sd-panel-title">Status Seluruh Task</div>
            <div className="sd-panel-note">Pipeline semester</div>
          </div>
          <div className="sd-status-wrap">
            <div className="sd-donut" style={{ background: donutBackground }}>
              <div className="sd-donut-center">
                <div className="sd-donut-total">{statusTotal}</div>
                <div className="sd-donut-label">task</div>
              </div>
            </div>
            <div className="sd-status-list">
              {statusItems.map((item) => (
                <div className="sd-status-item" key={item.key}>
                  <span className="sd-dot" style={{ background: item.tone }} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sd-grid bottom">
        <div className="sd-panel">
          <div className="sd-panel-head">
            <div className="sd-panel-title">Kontribusi Support KPI</div>
            <div className="sd-panel-note">Top 5 berdasarkan aktivitas Approved</div>
          </div>
          {kpiRows.length > 0 ? (
            <div className="sd-kpi-list">
              {kpiRows.map((item) => (
                <div className="sd-kpi-row" key={item.code}>
                  <div className="sd-kpi-name">
                    <div className="sd-kpi-code">{item.code}</div>
                    <div className="sd-kpi-desc">{item.description}</div>
                  </div>
                  <div className="sd-bar-track">
                    <div className="sd-bar-fill" style={{ width: `${(item.approved / maxKpiApproved) * 100}%` }} />
                  </div>
                  <div className="sd-kpi-metric">
                    <strong>{item.approved} task</strong>
                    R {pct(item.avgCompletion)}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="sd-empty">Belum ada task Approved yang terhubung ke Support KPI.</div>}
        </div>

        <div className="sd-panel">
          <div className="sd-panel-head">
            <div className="sd-panel-title">Carry Over Monitor</div>
            <div className="sd-panel-note">{supervisor ? `${carryOverTasks.length} task masih terbuka` : `${carryOverTasks.length} task saya masih terbuka`}</div>
          </div>
          {carryOverRows.length > 0 ? (
            <table className="sd-carry-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Carry Over</th>
                  <th>Usia Terlama</th>
                </tr>
              </thead>
              <tbody>
                {carryOverRows.map((item) => (
                  <tr key={item.name}>
                    <td className="sd-carry-name">{item.name}</td>
                    <td>{item.count} task</td>
                    <td><span className={`sd-age ${item.oldestWeeks >= 2 ? "high" : ""}`}>{item.oldestWeeks} minggu</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="sd-empty">Tidak ada carry over dari periode sebelumnya. ✅</div>}
        </div>
      </section>
    </div>
  );
}
