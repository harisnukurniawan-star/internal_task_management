import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPeriod } from "@/lib/data";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const period = await getCurrentPeriod(supabase);
  let query = supabase
    .from("leaderboard_weekly")
    .select("rank,avg_score,avg_complexity_score,avg_timeliness_score,avg_quality_score,avg_completion_score,total_assigned,total_approved,employees(full_name)")
    .order("rank", { ascending: true });
  if (period) query = query.eq("period_id", period.id);
  const { data: rowData } = await query;
  const rows = rowData ?? [];

  return (
    <>
      <PageHeader
        title="Weekly Leaderboard"
        subtitle={period ? `${period.label} · ranking berdasarkan rata-rata skor seluruh aktivitas.` : "Periode aktif"}
      />
      <div className="notice neutral">
        Skor aktivitas = rata-rata Kompleksitas + Ketepatan Waktu + Quality + Completion. Bonus ketepatan waktu dapat membuat skor aktivitas maksimum 102,5.
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
            {rows.map((row: any) => (
              <tr key={`${row.rank}-${row.employees?.full_name}`}>
                <td><strong>#{row.rank || "-"}</strong></td>
                <td>{row.employees?.full_name}</td>
                <td><strong>{Number(row.avg_score).toFixed(2)}</strong></td>
                <td>{Number(row.avg_complexity_score).toFixed(1)}</td>
                <td>{Number(row.avg_timeliness_score).toFixed(1)}</td>
                <td>{Number(row.avg_quality_score).toFixed(1)}</td>
                <td>{Number(row.avg_completion_score).toFixed(1)}</td>
                <td>{row.total_approved} / {row.total_assigned}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={8} className="empty">Belum ada data klasemen.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
