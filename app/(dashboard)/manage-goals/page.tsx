import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/data";

type ManageGoalsParams = {
  employee_id?: string;
  status?: string;
};

function relationOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function semesterFromDate(dateText: string) {
  const [yearText, monthText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const semester = month <= 6 ? 1 : 2;
  const startMonth = semester === 1 ? 1 : 7;
  return {
    year,
    semester,
    startMonth,
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: semester === 1 ? `${year}-06-30` : `${year}-12-31`,
    label: `${year}-${semester}`,
  };
}

function monthLabel(month: number) {
  return `Bulan ke-${month > 6 ? month - 6 : month}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return Number(value.toFixed(2)).toString();
}

type ApprovedMetric = {
  deadlineDate: string;
  score: number;
  quality: number;
  timeliness: number;
  completion: number;
  complexity: number;
};

const PMGM_TRACKING_START = { year: 2026, month: 9 };

function isTrackingMonth(year: number, month: number) {
  return year > PMGM_TRACKING_START.year || (year === PMGM_TRACKING_START.year && month >= PMGM_TRACKING_START.month);
}

export default async function ManageGoalsPMGMPage({
  searchParams,
}: {
  searchParams: Promise<ManageGoalsParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();

  if (!["admin", "supervisor"].includes(profile.role)) {
    return <p>Unauthorized</p>;
  }

  const [period, employeeResult] = await Promise.all([
    getCurrentPeriod(supabase),
    supabase
      .from("employees")
      .select("id,full_name,display_order")
      .eq("active", true)
      .order("display_order"),
  ]);

  const excludedNames = new Set(["harisnu kurniawan", "muhammad choiri"]);
  const employees = (employeeResult.data ?? []).filter(
    (item) => !excludedNames.has(String(item.full_name || "").trim().toLowerCase()),
  );

  const selectedEmployeeId = employees.some((item) => item.id === params.employee_id)
    ? params.employee_id!
    : employees[0]?.id;
  const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId);

  const referenceDate = period?.week_start ?? new Date().toISOString().slice(0, 10);
  const semester = semesterFromDate(referenceDate);
  const statusFilter = params.status === "active" || params.status === "inactive" ? params.status : "all";

  let kpis: any[] = [];
  let tasks: any[] = [];

  if (selectedEmployeeId) {
    const [kpiResult, taskResult] = await Promise.all([
      supabase
        .from("employee_kpis")
        .select("id,employee_id,kpi_code,kpi_description,achievement,period_label,active")
        .eq("employee_id", selectedEmployeeId)
        .order("kpi_code"),
      supabase
        .from("tasks")
        .select("id,support_kpi_id,due_at,task_claims(id,version,submitted_at,task_evaluations(decision,score,quality_score,timeliness_score,completion_score,complexity_score,evaluated_at))")
        .eq("assigned_to", selectedEmployeeId)
        .not("support_kpi_id", "is", null),
    ]);
    kpis = kpiResult.data ?? [];
    tasks = taskResult.data ?? [];
  }

  const activeCount = kpis.filter((item) => item.active).length;
  const inactiveCount = kpis.length - activeCount;
  const visibleKpis = kpis.filter((item) => {
    if (statusFilter === "active") return item.active;
    if (statusFilter === "inactive") return !item.active;
    return true;
  });

  const approvedMetricsByKpi = new Map<string, ApprovedMetric[]>();

  for (const task of tasks) {
    if (!task.support_kpi_id) continue;
    const claims = Array.isArray(task.task_claims) ? task.task_claims : [];
    const latestClaim = [...claims].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
    if (!latestClaim) continue;

    // Screening: hanya submission versi terbaru yang sudah Approved.
    const evaluation = relationOne(latestClaim.task_evaluations);
    if (!evaluation || evaluation.decision !== "approved") continue;

    // Realisasi bulanan mengikuti bulan deadline aktivitas.
    const deadlineDate = String(task.due_at || "").slice(0, 10);
    if (!deadlineDate || deadlineDate < semester.start || deadlineDate > semester.end) continue;

    const metric: ApprovedMetric = {
      deadlineDate,
      score: Number(evaluation.score),
      quality: Number(evaluation.quality_score),
      timeliness: Number(evaluation.timeliness_score),
      completion: Number(evaluation.completion_score),
      complexity: Number(evaluation.complexity_score),
    };
    if (!Number.isFinite(metric.completion)) continue;

    const existing = approvedMetricsByKpi.get(task.support_kpi_id) ?? [];
    existing.push(metric);
    approvedMetricsByKpi.set(task.support_kpi_id, existing);
  }

  const months = Array.from({ length: 6 }, (_, index) => semester.startMonth + index);
  const finalMonth = months[months.length - 1];

  function monthlyMetric(
    kpiId: string,
    month: number,
    field: "score" | "quality" | "timeliness" | "completion" | "complexity",
  ) {
    if (!isTrackingMonth(semester.year, month)) return null;
    const rows = approvedMetricsByKpi.get(kpiId) ?? [];
    const eligible = rows.filter((item) => {
      const [yearText, monthText] = item.deadlineDate.split("-");
      return Number(yearText) === semester.year && Number(monthText) === month;
    });
    if (eligible.length === 0) return null;

    const values = eligible
      .map((item) => item[field])
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.min(100, Math.max(0, value)));

    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function cumulativeMetric(
    kpiId: string,
    month: number,
    field: "score" | "quality" | "timeliness" | "completion" | "complexity",
  ) {
    const rows = approvedMetricsByKpi.get(kpiId) ?? [];
    const eligible = rows.filter((item) => {
      const [yearText, monthText] = item.deadlineDate.split("-");
      return Number(yearText) === semester.year
        && Number(monthText) <= month
        && isTrackingMonth(Number(yearText), Number(monthText));
    });
    if (eligible.length === 0) return null;
    const values = eligible.map((item) => item[field]).filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  const baseEmployeeQuery = (employeeId: string) =>
    `/manage-goals?employee_id=${encodeURIComponent(employeeId)}&status=${statusFilter}`;

  return (
    <div className="pmgm-shell">
      <style>{`
        .pmgm-shell{height:calc(100vh - 44px);display:grid;grid-template-columns:230px minmax(0,1fr);border:1px solid var(--line);background:#fff;overflow:hidden}
        .pmgm-people{border-right:1px solid #d9dee8;background:#fff;min-width:0;display:flex;flex-direction:column}
        .pmgm-people-title{padding:13px 12px 10px;font-size:16px;font-weight:800;color:#111827;border-bottom:1px solid var(--line)}
        .pmgm-search{margin:9px 10px;padding:7px 9px;border:1px solid #bcc6d6;border-radius:3px;font-size:12px;color:var(--muted)}
        .pmgm-section-label{padding:8px 12px 6px;font-size:11px;font-weight:800;color:#111827;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
        .pmgm-person{display:grid;grid-template-columns:38px 1fr 16px;gap:8px;align-items:center;padding:10px 10px;border-bottom:1px solid #edf0f5}
        .pmgm-person:hover,.pmgm-person.active{background:#eaf7fc}
        .pmgm-person.active{box-shadow:inset 3px 0 0 #0a94b7}
        .pmgm-avatar{width:36px;height:36px;border-radius:999px;border:2px dashed #1686d9;color:#1686d9;display:grid;place-items:center;font-size:11px;font-weight:800}
        .pmgm-person-name{font-size:12px;font-weight:700;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pmgm-person-role{font-size:10px;color:#667085;margin-top:3px}
        .pmgm-main{min-width:0;display:flex;flex-direction:column;overflow:hidden}
        .pmgm-app-tabs{display:flex;gap:24px;align-items:flex-end;height:38px;padding:0 24px;border-bottom:1px solid var(--line);flex:0 0 auto}
        .pmgm-app-tab{height:38px;display:flex;align-items:center;font-size:12px;font-weight:800;color:#2a3587;border-bottom:2px solid #0a94b7}
        .pmgm-head{padding:12px 24px 10px;background:#f7f7f8;border-bottom:1px solid var(--line);flex:0 0 auto}
        .pmgm-head-top{display:flex;justify-content:flex-start;gap:12px;align-items:flex-start}
        .pmgm-title{font-size:22px;font-weight:800;color:#111827}
        .pmgm-subtitle{font-size:11px;color:#667085;margin-top:5px}
        .pmgm-summary{display:flex;align-items:center;gap:20px;padding:12px 24px;background:#fff;border-bottom:1px solid var(--line);flex:0 0 auto}
        .pmgm-total{font-size:24px;font-weight:800;color:#111827}
        .pmgm-total small{font-size:11px;font-weight:700;margin-left:5px}
        .pmgm-status-link{display:grid;place-items:center;gap:3px;min-width:50px;color:#111827;font-size:10px}
        .pmgm-status-circle{width:38px;height:38px;border-radius:999px;border:2px solid #1686d9;display:grid;place-items:center;font-size:12px;font-weight:800}
        .pmgm-status-link.inactive .pmgm-status-circle{border-color:#ff3d4d}
        .pmgm-status-link.previous .pmgm-status-circle{border-color:#8a94a6;color:#667085}
        .pmgm-status-link.selected{border-bottom:2px solid #ff3d4d;padding-bottom:5px}
        .pmgm-complete{display:flex;gap:6px;align-items:center;font-size:11px;color:#12823b}
        .pmgm-table-wrap{flex:1 1 auto;min-height:0;overflow:auto;background:#fff}
        .pmgm-table{border-collapse:separate;border-spacing:0;min-width:1950px;width:100%;table-layout:fixed}
        .pmgm-table th,.pmgm-table td{border-right:1px solid #e1e5eb;border-bottom:1px solid #e1e5eb;padding:8px 9px;font-size:10px;vertical-align:top;background:#fff}
        .pmgm-table th{position:sticky;top:0;z-index:4;background:#f2f4f7;color:#111827;font-weight:800;text-align:center}
        .pmgm-table .sticky-code{position:sticky;left:0;z-index:3;background:#fff}
        .pmgm-table th.sticky-code{z-index:6;background:#f2f4f7}
        .pmgm-table .sticky-desc{position:sticky;left:135px;z-index:3;background:#fff}
        .pmgm-table th.sticky-desc{z-index:6;background:#f2f4f7}
        .pmgm-kpi-code{font-weight:700;word-break:break-word}
        .pmgm-kpi-desc{line-height:1.3}
        .pmgm-attr{display:grid;gap:5px;color:#111827}
        .pmgm-attr span{display:flex;justify-content:space-between;gap:8px}
        .pmgm-status{font-weight:700;color:#111827}
        .pmgm-month{display:grid;gap:8px;min-height:72px}
        .pmgm-month span{display:flex;gap:5px}
        .pmgm-month strong{width:12px}
        .pmgm-empty{padding:28px!important;text-align:center;color:var(--muted)}
        @media(max-width:1100px){.pmgm-shell{grid-template-columns:190px minmax(0,1fr)}}
      `}</style>

      <aside className="pmgm-people">
        <div className="pmgm-people-title">People Selector</div>
        <div className="pmgm-search">Search direct report</div>
        <div className="pmgm-section-label">Direct Reports</div>
        <div>
          {employees.map((employee) => (
            <Link
              key={employee.id}
              href={baseEmployeeQuery(employee.id)}
              className={`pmgm-person ${employee.id === selectedEmployeeId ? "active" : ""}`}
            >
              <div className="pmgm-avatar">{initials(employee.full_name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="pmgm-person-name">{employee.full_name}</div>
                <div className="pmgm-person-role">EMPLOYEE · PMGM</div>
              </div>
              <span>›</span>
            </Link>
          ))}
        </div>
      </aside>

      <main className="pmgm-main">
        <div className="pmgm-app-tabs">
          <span className="pmgm-app-tab">KPI</span>
        </div>

        <section className="pmgm-head">
          <div className="pmgm-head-top">
            <div>
              <div className="pmgm-title">{semester.label} KPI</div>
              <div className="pmgm-subtitle">
                {semester.start} – {semester.end} · {selectedEmployee?.full_name || "Pilih pegawai"} · State: Active
              </div>
            </div>
          </div>
        </section>

        <section className="pmgm-summary">
          <div className="pmgm-total">{kpis.length}<small>KPI</small></div>
          <Link href={`/manage-goals?employee_id=${selectedEmployeeId || ""}&status=active`} className={`pmgm-status-link ${statusFilter === "active" ? "selected" : ""}`}>
            <span className="pmgm-status-circle">{activeCount}</span>
            <strong>Aktif</strong>
          </Link>
          <div className="pmgm-status-link previous">
            <span className="pmgm-status-circle">0</span>
            <strong>Previous Job</strong>
          </div>
          <Link href={`/manage-goals?employee_id=${selectedEmployeeId || ""}&status=inactive`} className={`pmgm-status-link inactive ${statusFilter === "inactive" ? "selected" : ""}`}>
            <span className="pmgm-status-circle">{inactiveCount}</span>
            <strong>Non Aktif</strong>
          </Link>
          <Link href={`/manage-goals?employee_id=${selectedEmployeeId || ""}&status=all`} className={`pmgm-status-link ${statusFilter === "all" ? "selected" : ""}`}>
            <span className="pmgm-status-circle">{kpis.length}</span>
            <strong>Semua</strong>
          </Link>
          <div className="pmgm-complete">● {kpis.length} KPI terpetakan</div>
        </section>

        <div className="pmgm-table-wrap">
          <table className="pmgm-table">
            <colgroup>
              <col style={{ width: 135 }} />
              <col style={{ width: 225 }} />
              <col style={{ width: 230 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 78 }} />
              {months.map((month) => <col key={month} style={{ width: 105 }} />)}
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 145 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky-code">Kode KPI</th>
                <th className="sticky-desc">Deskripsi KPI</th>
                <th>Atribut KPI</th>
                <th>Kuadran</th>
                <th>Status KPI</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Tipe Cascading</th>
                <th>Jumlah Target</th>
                {months.map((month) => <th key={month}>{monthLabel(month)}</th>)}
                <th>Pengisian Kualitas</th>
                <th>Pengisian Waktu</th>
                <th>Pengisian Target Kuantitas Range</th>
                <th>Realisasi Range</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {visibleKpis.map((kpi) => (
                <tr key={kpi.id}>
                  <td className="sticky-code"><div className="pmgm-kpi-code">{kpi.kpi_code}</div></td>
                  <td className="sticky-desc"><div className="pmgm-kpi-desc">{kpi.kpi_description}</div></td>
                  <td>
                    <div className="pmgm-attr">
                      <span><strong>Polarisasi:</strong><em>Positif</em></span>
                      <span><strong>Satuan:</strong><em>Persentase</em></span>
                      <span><strong>Tipe Target:</strong><em>Akumulatif</em></span>
                      <span><strong>Target Range:</strong><em>Not Applicable</em></span>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>1</td>
                  <td><span className="pmgm-status">{kpi.active ? "Aktif" : "Non Aktif"}</span></td>
                  <td>{semester.start}</td>
                  <td>{semester.end}</td>
                  <td>Non Direct</td>
                  <td style={{ textAlign: "center" }}>1</td>
                  {months.map((month) => {
                    const tracked = isTrackingMonth(semester.year, month);
                    const realization = monthlyMetric(kpi.id, month, "completion");
                    const target = tracked ? 100 : null;
                    return (
                      <td key={month}>
                        <div className="pmgm-month">
                          <span><strong>T:</strong>{formatScore(target)}</span>
                          <span><strong>R:</strong>{formatScore(realization)}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <div className="pmgm-month" style={{ gap: 4 }}>
                      {months.filter((month) => isTrackingMonth(semester.year, month)).map((month) => (
                        <span key={month}><strong>B{month - semester.startMonth + 1}:</strong>{formatScore(monthlyMetric(kpi.id, month, "quality"))}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="pmgm-month" style={{ gap: 4 }}>
                      {months.filter((month) => isTrackingMonth(semester.year, month)).map((month) => (
                        <span key={month}><strong>B{month - semester.startMonth + 1}:</strong>{formatScore(monthlyMetric(kpi.id, month, "timeliness"))}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="pmgm-month" style={{ gap: 5 }}>
                      <span>Titik 1: -</span>
                      <span>Titik 2: -</span>
                      <span>Titik 3: -</span>
                      <span>Titik 4: -</span>
                    </div>
                  </td>
                  <td>{formatScore(cumulativeMetric(kpi.id, finalMonth, "completion"))}</td>
                  <td><strong>{formatScore(cumulativeMetric(kpi.id, finalMonth, "score"))}</strong></td>
                </tr>
              ))}
              {visibleKpis.length === 0 ? (
                <tr><td colSpan={20} className="pmgm-empty">Belum ada KPI pada filter ini untuk pegawai terpilih.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
