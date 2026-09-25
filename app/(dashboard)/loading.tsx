export default function DashboardLoading() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ display: "grid", gap: 10 }}>
      <div className="topbar" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ width: 220, height: 22, borderRadius: 7, background: "var(--blue-soft)" }} />
          <div style={{ width: 320, maxWidth: "70vw", height: 11, borderRadius: 6, background: "#eef1f7", marginTop: 8 }} />
        </div>
      </div>
      <div className="card" style={{ minHeight: 120, display: "grid", placeItems: "center" }}>
        <span className="muted small">Memuat data…</span>
      </div>
    </div>
  );
}
