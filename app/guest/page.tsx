const tasks = [
  { title: "Weekly progress operational", owner: "Endang Mirah Ayu", complexity: "Koordinasi Internal Tim", due: "23 Sep 2026", status: "submitted" },
  { title: "Evidence completion follow-up", owner: "Citra Aries", complexity: "Koordinasi BPO", due: "24 Sep 2026", status: "approved" },
  { title: "Strategic task monitoring", owner: "Heri Syamsudin", complexity: "Koordinasi dengan Kantor Pusat", due: "25 Sep 2026", status: "revision" },
];

const reviews = [
  { owner: "Endang Mirah Ayu", task: "Weekly progress operational", quality: "Menunggu validasi", evidence: "Ada", score: "-", status: "submitted" },
  { owner: "Citra Aries", task: "Evidence completion follow-up", quality: "Sesuai arahan", evidence: "Ada", score: "97.5", status: "approved" },
  { owner: "Heri Syamsudin", task: "Strategic task monitoring", quality: "Koreksi Minor", evidence: "Ada", score: "91.3", status: "revision" },
];

const leaderboard = [
  { rank: 1, name: "Endang Mirah Ayu", activity: 96.4, complexity: 72, timeliness: 106, quality: 95, completion: 100 },
  { rank: 2, name: "Citra Aries", activity: 92.8, complexity: 68, timeliness: 103, quality: 90, completion: 100 },
  { rank: 3, name: "Heri Syamsudin", activity: 87.6, complexity: 76, timeliness: 98, quality: 80, completion: 96 },
];

export default function GuestPage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>Guest · Read-only demo</small></div>
        <nav className="nav">
          <a href="#dashboard">Dashboard</a>
          <a href="#tasks">Team Tasks</a>
          <a href="#reviews">Validation & Evaluation</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>
        <a className="btn secondary" href="/login" style={{ marginTop: "auto", textAlign: "center" }}>Kembali ke Login</a>
      </aside>

      <main className="main">
        <div className="notice warning">
          <strong>Guest Mode.</strong> Preview read-only dengan data contoh. Scoring: Kompleksitas + Ketepatan Waktu + Quality + Completion evidence, lalu dirata-ratakan per aktivitas.
        </div>

        <section id="dashboard">
          <div className="topbar">
            <div className="page-title"><h1>Dashboard</h1><p>Preview Supervisor · Minggu berjalan</p></div>
            <span className="badge">Read-only</span>
          </div>
          <div className="cards">
            <div className="card"><span className="muted">Total task</span><div className="metric">12</div></div>
            <div className="card"><span className="muted">Submitted</span><div className="metric">4</div></div>
            <div className="card"><span className="muted">Approved</span><div className="metric">7</div></div>
            <div className="card"><span className="muted">Revision</span><div className="metric">1</div></div>
          </div>
        </section>

        <section id="tasks" className="section">
          <div className="topbar"><div className="page-title"><h1>Team Tasks</h1><p>Bobot diganti menjadi Kompleksitas</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Task</th><th>Employee</th><th>Kompleksitas</th><th>Due date</th><th>Status</th></tr></thead><tbody>
            {tasks.map((task) => <tr key={task.title}><td>{task.title}</td><td>{task.owner}</td><td>{task.complexity}</td><td>{task.due}</td><td><span className={`badge ${task.status}`}>{task.status}</span></td></tr>)}
          </tbody></table></div>
        </section>

        <section id="reviews" className="section">
          <div className="topbar"><div className="page-title"><h1>Validation & Evaluation</h1><p>Quality dinilai atasan dan evidence terlihat di sini</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Task</th><th>Quality</th><th>Evidence</th><th>Skor Aktivitas</th><th>Status</th></tr></thead><tbody>
            {reviews.map((item) => <tr key={`${item.owner}-${item.task}`}><td>{item.owner}</td><td>{item.task}</td><td>{item.quality}</td><td>{item.evidence}</td><td>{item.score}</td><td><span className={`badge ${item.status}`}>{item.status}</span></td></tr>)}
          </tbody></table></div>
        </section>

        <section id="leaderboard" className="section">
          <div className="topbar"><div className="page-title"><h1>Leaderboard</h1><p>Rata-rata seluruh aktivitas per pegawai</p></div></div>
          <div className="notice neutral">Ketepatan waktu: deadline = 100, +5 per 24 jam lebih cepat hingga maks. 110, -5 per 24 jam terlambat.</div>
          <div className="table-wrap section-sm"><table><thead><tr><th>Rank</th><th>Employee</th><th>Avg Aktivitas</th><th>Kompleksitas</th><th>Ketepatan Waktu</th><th>Quality</th><th>Completion</th></tr></thead><tbody>
            {leaderboard.map((row) => <tr key={row.name}><td><strong>#{row.rank}</strong></td><td>{row.name}</td><td><strong>{row.activity}</strong></td><td>{row.complexity}</td><td>{row.timeliness}</td><td>{row.quality}</td><td>{row.completion}</td></tr>)}
          </tbody></table></div>
        </section>
      </main>
    </div>
  );
}
