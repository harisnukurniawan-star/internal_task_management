const tasks = [
  { title: "Weekly progress operational", owner: "Endang Mirah Ayu", due: "23 Sep 2026", status: "submitted" },
  { title: "Evidence completion follow-up", owner: "Citra Aries", due: "24 Sep 2026", status: "approved" },
  { title: "Strategic task monitoring", owner: "Heri Syamsudin", due: "25 Sep 2026", status: "revision" },
];

const reviews = [
  { owner: "Endang Mirah Ayu", task: "Weekly progress operational", decision: "Menunggu validasi", status: "submitted" },
  { owner: "Citra Aries", task: "Evidence completion follow-up", decision: "Disetujui", status: "approved" },
  { owner: "Heri Syamsudin", task: "Strategic task monitoring", decision: "Perlu revisi", status: "revision" },
];

const leaderboard = [
  { rank: 1, name: "Endang Mirah Ayu", approved: 8, completion: "92%", points: 94 },
  { rank: 2, name: "Citra Aries", approved: 7, completion: "88%", points: 90 },
  { rank: 3, name: "Heri Syamsudin", approved: 6, completion: "81%", points: 84 },
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
          <strong>Guest Mode.</strong> Tampilan ini hanya preview dengan data contoh. Semua fitur create, edit, upload, approve, dan akses data privat dinonaktifkan.
        </div>

        <section id="dashboard">
          <div className="topbar">
            <div className="page-title">
              <h1>Dashboard</h1>
              <p>Preview Supervisor · Minggu berjalan</p>
            </div>
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
          <div className="topbar">
            <div className="page-title">
              <h1>Team Tasks</h1>
              <p>Contoh monitoring task tim</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Employee</th><th>Due date</th><th>Status</th></tr></thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.title}><td>{task.title}</td><td>{task.owner}</td><td>{task.due}</td><td><span className={`badge ${task.status}`}>{task.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="reviews" className="section">
          <div className="topbar">
            <div className="page-title">
              <h1>Validation & Evaluation</h1>
              <p>Preview antrean validasi Supervisor</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Task</th><th>Decision</th><th>Status</th></tr></thead>
              <tbody>
                {reviews.map((item) => (
                  <tr key={`${item.owner}-${item.task}`}><td>{item.owner}</td><td>{item.task}</td><td>{item.decision}</td><td><span className={`badge ${item.status}`}>{item.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="leaderboard" className="section">
          <div className="topbar">
            <div className="page-title">
              <h1>Leaderboard</h1>
              <p>Contoh ranking mingguan</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Employee</th><th>Approved</th><th>Completion</th><th>Points</th></tr></thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.name}><td><strong>#{row.rank}</strong></td><td>{row.name}</td><td>{row.approved}</td><td>{row.completion}</td><td><strong>{row.points}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
