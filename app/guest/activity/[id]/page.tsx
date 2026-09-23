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
          <a href="/guest/dashboard">Dashboard</a>
          <a href="/guest/my-week">My Week</a>
          <a href="/guest/my-tasks">My Tasks</a>
          <a href="/guest/leaderboard">Leaderboard</a>
        </nav>
        <a className="btn secondary" href="/guest/my-week" style={{ marginTop: "auto", textAlign: "center" }}>Kembali</a>
      </aside>
      <main className="main">
        <div className="notice warning"><strong>Guest Mode · View-only.</strong> Detail aktivitas dapat dibaca, tetapi seluruh perubahan data dinonaktifkan.</div>
        <div className="topbar">
          <div className="page-title"><h1>{task.title}</h1><p>Detail Aktivitas · Employee preview</p></div>
          <span className={`badge ${task.status}`}>{task.status}</span>
        </div>
        <section className="card">
          <h3>Informasi Aktivitas</h3>
          <div className="task-meta">
            <span>Priority: {task.priority}</span>
            <span>Kompleksitas: {task.complexity}</span>
            <span>Due: {task.due}</span>
          </div>
          <div className="section-sm"><strong>Deskripsi</strong><p>{task.description}</p></div>
          <div className="submission-box">
            <strong>Realisasi</strong>
            <p>{task.realization}</p>
            <span className="muted small">Evidence dummy: {task.evidence}</span>
          </div>
          <div className="notice neutral section-sm">Read-only · submit realisasi, upload evidence, dan revisi tidak tersedia pada Guest.</div>
        </section>
      </main>
    </div>
  );
}
