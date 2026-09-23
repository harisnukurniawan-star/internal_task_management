const tasks = [
  { title: "Weekly progress operational", complexity: "Koordinasi Internal Tim", due: "23 Sep 2026", status: "submitted" },
  { title: "Evidence completion follow-up", complexity: "Koordinasi BPO", due: "24 Sep 2026", status: "approved" },
  { title: "Strategic task monitoring", complexity: "Koordinasi dengan Kantor Pusat", due: "25 Sep 2026", status: "revision" },
];

function GuestHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="topbar"><div className="page-title"><h1>{title}</h1><p>{subtitle}</p></div><span className="badge">Read-only</span></div>;
}

export function GuestView({ active = "dashboard" }: { active?: string }) {

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>Guest · Employee · View-only</small></div>
        <nav className="nav">
          <a className={active === "dashboard" ? "active" : ""} href="/guest/dashboard">Dashboard</a>
          <a className={active === "my-week" ? "active" : ""} href="/guest/my-week">My Week</a>
          <a className={active === "my-tasks" ? "active" : ""} href="/guest/my-tasks">My Tasks</a>
          <a className={active === "leaderboard" ? "active" : ""} href="/guest/leaderboard">Leaderboard</a>
        </nav>
        <a className="btn secondary" href="/login" style={{ marginTop: "auto", textAlign: "center" }}>Keluar Guest</a>
      </aside>

      <main className="main">
        <div className="notice warning"><strong>Guest Mode · Employee View-only.</strong> Akses temporer pengembangan. Seluruh aksi tulis, submit, upload, revisi, dan perubahan data dinonaktifkan.</div>

        {active === "dashboard" ? (
          <>
            <GuestHeader title="Dashboard" subtitle="Preview Employee · data contoh" />
            <div className="cards">
              <div className="card"><span className="muted">Total task</span><div className="metric">3</div></div>
              <div className="card"><span className="muted">Submitted</span><div className="metric">1</div></div>
              <div className="card"><span className="muted">Approved</span><div className="metric">1</div></div>
              <div className="card"><span className="muted">Revision</span><div className="metric">1</div></div>
            </div>
          </>
        ) : null}

        {active === "my-week" ? (
          <>
            <GuestHeader title="My Week" subtitle="Task periode aktif · Employee preview" />
            <div className="table-wrap"><table><thead><tr><th>Task</th><th>Priority</th><th>Kompleksitas</th><th>Status</th><th>Due</th></tr></thead><tbody>
              {tasks.map((task) => <tr key={task.title}><td>{task.title}</td><td>medium</td><td>{task.complexity}</td><td><span className={`badge ${task.status}`}>{task.status}</span></td><td>{task.due}</td></tr>)}
            </tbody></table></div>
          </>
        ) : null}

        {active === "my-tasks" ? (
          <>
            <GuestHeader title="My Tasks" subtitle="Task periode aktif · Employee preview" />
            <div className="grid-2">
              {tasks.map((task) => (
                <section className="card compact" key={task.title}>
                  <div className="card-head"><strong>{task.title}</strong><span className={`badge ${task.status}`}>{task.status}</span></div>
                  <p className="muted">Contoh task untuk pengujian tampilan Guest.</p>
                  <div className="task-meta"><span>Priority: medium</span><span>Kompleksitas: {task.complexity}</span><span>Due: {task.due}</span></div>
                  <div className="notice neutral">View-only · form realisasi dan upload evidence dikunci untuk Guest.</div>
                </section>
              ))}
            </div>
          </>
        ) : null}

        {active === "leaderboard" ? (
          <>
            <GuestHeader title="Weekly Leaderboard" subtitle="Ranking berdasarkan rata-rata skor seluruh aktivitas." />
            <div className="notice neutral">Skor aktivitas = rata-rata Kompleksitas + Ketepatan Waktu + Quality + Completion.</div>
            <div className="table-wrap section-sm"><table><thead><tr><th>Rank</th><th>Employee</th><th>Avg Aktivitas</th><th>Kompleksitas</th><th>Ketepatan Waktu</th><th>Quality</th><th>Completion</th><th>Approved / Assigned</th></tr></thead><tbody>
              <tr><td><strong>#1</strong></td><td>Endang Mirah Ayu</td><td><strong>96.40</strong></td><td>72.0</td><td>106.0</td><td>95.0</td><td>100.0</td><td>3 / 3</td></tr>
              <tr><td><strong>#2</strong></td><td>Citra Aries</td><td><strong>92.80</strong></td><td>68.0</td><td>103.0</td><td>90.0</td><td>100.0</td><td>2 / 3</td></tr>
              <tr><td><strong>#3</strong></td><td>Heri Syamsudin</td><td><strong>87.60</strong></td><td>76.0</td><td>98.0</td><td>80.0</td><td>96.0</td><td>2 / 3</td></tr>
            </tbody></table></div>
          </>
        ) : null}
      </main>
    </div>
  );
}


export default function GuestPage() { return <GuestView active="dashboard" />; }
