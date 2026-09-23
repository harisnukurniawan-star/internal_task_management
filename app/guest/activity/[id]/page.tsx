import { notFound } from "next/navigation";
import { tasks } from "../../page";

export default async function GuestActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = tasks.find((item) => item.id === id);
  if (!task) notFound();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>Guest · Employee · View-only</small></div>
        <nav className="nav">
          <a href="/guest/dashboard">Dashboard</a><a href="/guest/my-week">My Week</a>
          <a className="active" href="/guest/my-tasks">My Tasks</a><a href="/guest/leaderboard">Leaderboard</a>
        </nav>
        <a className="btn secondary" href="/login" style={{ marginTop: "auto", textAlign: "center" }}>Keluar Guest</a>
      </aside>
      <main className="main">
        <div className="notice warning"><strong>Guest Mode · Employee View-only.</strong> Form dibuat sama seperti Employee, tetapi seluruh input dan submit dikunci.</div>
        <div className="topbar"><div className="page-title"><h1>My Tasks</h1><p>Preview aktivitas Employee</p></div><span className="badge">Read-only</span></div>
        <section className="card compact" style={{ maxWidth: 640 }}>
          <div className="card-head"><strong>{task.title}</strong><span className={`badge ${task.status}`}>{task.status}</span></div>
          <p className="muted">{task.description}</p>
          <div className="task-meta"><span>Priority: {task.priority}</span><span>Kompleksitas: {task.complexity}</span><span>Due: {task.due}</span></div>
          <form className="form section-sm">
            <div className="field"><label>Realisasi</label><textarea value={task.realization} readOnly disabled /></div>
            <div className="field"><label>Upload evidence</label><input type="file" disabled /><small className="muted">PDF/JPG/PNG/WebP · maks. 3 MB. Guest hanya dapat melihat simulasi form.</small></div>
            <button className="btn" type="button" disabled aria-disabled="true">Submit Realisasi · View-only</button>
          </form>
          <a className="btn secondary section-sm" href="/guest/my-tasks" style={{ display: "inline-block" }}>Kembali ke My Tasks</a>
        </section>
      </main>
    </div>
  );
}
