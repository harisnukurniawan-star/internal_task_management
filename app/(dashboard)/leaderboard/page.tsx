import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPeriod } from "@/lib/data";

type SemesterAggregate = {
  employeeId: string;
  employeeName: string;
  totalAssigned: number;
  totalApproved: number;
  weightedAvgScore: number;
  weightedComplexityScore: number;
  weightedTimelinessScore: number;
  weightedQualityScore: number;
  weightedCompletionScore: number;
};

function getSemesterBounds(referenceDate: string) {
  const [yearText, monthText] = referenceDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const semester = month <= 6 ? 1 : 2;

  return {
    year,
    semester,
    start: `${year}-${semester === 1 ? "01-01" : "07-01"}`,
    end: `${year}-${semester === 1 ? "06-30" : "12-31"}`,
  };
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const currentPeriod = await getCurrentPeriod(supabase);
  const referenceDate = currentPeriod?.week_start ?? new Date().toISOString().slice(0, 10);
  const semester = getSemesterBounds(referenceDate);

  const [{ data: periodsData }, { data: employeesData }] = await Promise.all([
    supabase
      .from("weekly_periods")
      .select("id,label,week_start,week_end,status")
      .gte("week_start", semester.start)
      .lte("week_start", semester.end)
      .order("week_start", { ascending: true }),
    supabase
      .from("employees")
      .select("id,full_name,display_order")
      .eq("active", true)
      .order("display_order", { ascending: true }),
  ]);

  const semesterPeriods = periodsData ?? [];
  const periodIds = semesterPeriods.map((period: any) => period.id);

  let leaderboardData: any[] = [];
  if (periodIds.length > 0) {
    const { data } = await supabase
      .from("leaderboard_weekly")
      .select(
        "period_id,employee_id,avg_score,avg_complexity_score,avg_timeliness_score,avg_quality_score,avg_completion_score,total_assigned,total_approved",
      )
      .in("period_id", periodIds);
    leaderboardData = data ?? [];
  }

  const aggregates = new Map<string, SemesterAggregate>();

  for (const employee of employeesData ?? []) {
    aggregates.set(employee.id, {
      employeeId: employee.id,
      employeeName: employee.full_name,
      totalAssigned: 0,
      totalApproved: 0,
      weightedAvgScore: 0,
      weightedComplexityScore: 0,
      weightedTimelinessScore: 0,
      weightedQualityScore: 0,
      weightedCompletionScore: 0,
    });
  }

  for (const row of leaderboardData) {
    const aggregate = aggregates.get(row.employee_id);
    if (!aggregate) continue;

    const assigned = Number(row.total_assigned ?? 0);
    aggregate.totalAssigned += assigned;
    aggregate.totalApproved += Number(row.total_approved ?? 0);
    aggregate.weightedAvgScore += Number(row.avg_score ?? 0) * assigned;
    aggregate.weightedComplexityScore += Number(row.avg_complexity_score ?? 0) * assigned;
    aggregate.weightedTimelinessScore += Number(row.avg_timeliness_score ?? 0) * assigned;
    aggregate.weightedQualityScore += Number(row.avg_quality_score ?? 0) * assigned;
    aggregate.weightedCompletionScore += Number(row.avg_completion_score ?? 0) * assigned;
  }

  const rows = Array.from(aggregates.values())
    .map((row) => {
      const divisor = row.totalAssigned || 1;
      return {
        ...row,
        avgScore: row.totalAssigned ? row.weightedAvgScore / divisor : 0,
        avgComplexityScore: row.totalAssigned ? row.weightedComplexityScore / divisor : 0,
        avgTimelinessScore: row.totalAssigned ? row.weightedTimelinessScore / divisor : 0,
        avgQualityScore: row.totalAssigned ? row.weightedQualityScore / divisor : 0,
        avgCompletionScore: row.totalAssigned ? row.weightedCompletionScore / divisor : 0,
      };
    })
    .sort(
      (a, b) =>
        b.avgScore - a.avgScore ||
        b.avgQualityScore - a.avgQualityScore ||
        b.avgTimelinessScore - a.avgTimelinessScore ||
        b.avgCompletionScore - a.avgCompletionScore ||
        a.employeeName.localeCompare(b.employeeName),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const semesterLabel = `Semester ${semester.semester === 1 ? "I" : "II"} ${semester.year}`;
  const activePeriodCount = semesterPeriods.filter((period: any) => period.status !== "planned").length;

  return (
    <>
      <PageHeader
        title="Semester Leaderboard"
        subtitle={`${semesterLabel} · ranking kumulatif seluruh aktivitas dari semua periode dalam semester yang sama.`}
      />
      <div className="notice neutral">
        Cakupan: {semesterPeriods.length} periode semester ({activePeriodCount} sudah aktif/selesai). Skor semester dihitung sebagai rata-rata seluruh aktivitas, sehingga periode dengan jumlah task lebih banyak memiliki bobot sesuai jumlah aktivitasnya. Bonus ketepatan waktu tetap dapat membuat skor aktivitas maksimum 102,5.
      </div>
      <div className="table-wrap section-sm">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Employee</th>
              <th>Avg Aktivitas</th>
              <th>Kompleksitas</th>
              <th>Ketepatan Waktu</th>
              <th>Quality</th>
              <th>Completion</th>
              <th>Approved / Assigned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId}>
                <td><strong>#{row.rank}</strong></td>
                <td>{row.employeeName}</td>
                <td><strong>{row.avgScore.toFixed(2)}</strong></td>
                <td>{row.avgComplexityScore.toFixed(1)}</td>
                <td>{row.avgTimelinessScore.toFixed(1)}</td>
                <td>{row.avgQualityScore.toFixed(1)}</td>
                <td>{row.avgCompletionScore.toFixed(1)}</td>
                <td>{row.totalApproved} / {row.totalAssigned}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={8} className="empty">Belum ada data klasemen semester.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
