const tasks = [
  { title: "Weekly progress operational", complexity: "Koordinasi Internal Tim", due: "23 Sep 2026", status: "submitted" },
  { title: "Evidence completion follow-up", complexity: "Koordinasi BPO", due: "24 Sep 2026", status: "approved" },
  { title: "Strategic task monitoring", complexity: "Koordinasi dengan Kantor Pusat", due: "25 Sep 2026", status: "revision" },
];

export default function GuestPage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>Guest · Employee · View-only</small></div>
        <nav className="nav">
          <a href="#dashboard">Dashboard</a>
          <a href="#my-week">My Week</a>
          <a href="#my-tasks">My Tasks</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>
        <a className="btn secondary" href="/login" style={{ marginTop: "auto", textAlign: "center" }}>Keluar Guest</a>
      </aside>

      <main className="main">
        <div className="notice warning">
          <strong>Guest Mode · Employee View-only.</strong> Akses temporer untuk pengembangan aplikasi. Tampilan mengikuti otorisasi Employee, tetapi seluruh aksi tulis, submit, upload, revisi, dan perubahan data dinonaktifkan.
        </div>

        <section id="dashboard">
          <div className="topbar">
            <div className="page-title"><h1>Dashboard</h1><p>Preview Employee · data contoh</p></div>
            <span className="badge">Read-only</span>
          </div>
          <div className="cards">
            <div className="card"><span className="muted">Total task</span><div className="metric">3</div></div>
            <div className="card"><span className="muted">Submitted</span><div className="metric">1</div></div>
            <div className="card"><span className="muted">Approved</span><div className="metric">1</div></div>
            <div className="card"><span className="muted">Revision</span><div className="metric">1</div></div>
          </div>
        </section>

        <section id="my-week" className="section">
          <div className="topbar"><div className="page-title"><h1>My Week</h1><p>Task periode aktif · Employee preview</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Task</th><th>Kompleksitas</th><th>Due</th><th>Status</th></tr></thead><tbody>
            {tasks.map((task) => <tr key={task.title}><td>{task.title}</td><td>{task.complexity}</td><td>{task.due}</td><td><span className={`badge ${task.status}`}>{task.status}</span></td></tr>)}
          </tbody></table></div>
        </section>

        <section id="my-tasks" className="section">
          <div className="topbar"><div className="page-title"><h1>My Tasks</h1><p>Struktur akses sama seperti Employee, seluruh kontrol input dikunci.</p></div></div>
          <div className="grid-2">
            {tasks.map((task) => (
              <section className="card compact" key={task.title}>
                <div className="card-head"><strong>{task.title}</strong><span className={`badge ${task.status}`}>{task.status}</span></div>
                <p className="muted">Contoh task untuk pengujian tampilan Guest.</p>
                <div className="task-meta"><span>Kompleksitas: {task.complexity}</span><span>Due: {task.due}</span></div>
                <button className="btn" type="button" disabled aria-disabled="true">Submit Realisasi · View-only</button>
              </section>
            ))}
          </div>
        </section>

        <section id="leaderboard" className="section">
          <div className="topbar"><div className="page-title"><h1>Leaderboard</h1><p>Employee dapat melihat klasemen; Guest mengikuti akses baca yang sama.</p></div></div>
          <div className="notice neutral">Guest tidak memiliki identitas Employee dan tidak menulis apa pun ke Supabase.</div>
          <div className="table-wrap section-sm"><table><thead><tr><th>Rank</th><th>Employee</th><th>Avg Aktivitas</th></tr></thead><tbody>
            <tr><td><strong>#1</strong></td><td>Endang Mirah Ayu</td><td>96.40</td></tr>
            <tr><td><strong>#2</strong></td><td>Citra Aries</td><td>92.80</td></tr>
            <tr><td><strong>#3</strong></td><td>Heri Syamsudin</td><td>87.60</td></tr>
          </tbody></table></div>
        </section>
      </main>
    </div>
  );
}
