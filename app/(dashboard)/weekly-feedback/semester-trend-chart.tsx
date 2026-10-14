type WeeklyPoint = {
  weekStart: string;
  label: string;
  self: number | null;
  calibrated: number | null;
  submissions: number;
  calibrations: number;
};
type Dimension = { label: string; self: number | null; calibrated: number | null };

function labelScore(v: number | null) { return v === null ? "—" : v.toFixed(2); }
function widthFor(v: number | null) { return ((v ?? 0) / 5 * 100).toFixed(1) + "%"; }

export function SemesterTrendChart({
  points, dimensions, semesterLabel, totalEntries, totalCalibrated,
}: {
  points: WeeklyPoint[];
  dimensions: Dimension[];
  semesterLabel: string;
  totalEntries: number;
  totalCalibrated: number;
}) {
  const left = 46, right = 968, top = 16, bottom = 254;
  const x = (index: number) => left + (points.length < 2 ? .5 : index / (points.length - 1)) * (right - left);
  const y = (value: number) => top + (5 - Math.min(5, Math.max(1, value))) / 4 * (bottom - top);
  function pathFor(key: "self" | "calibrated") {
    let connected = false;
    return points.map((point, index) => {
      const value = point[key];
      if (value === null) { connected = false; return ""; }
      const instruction = connected ? "L" : "M";
      connected = true;
      return instruction + x(index).toFixed(1) + "," + y(value).toFixed(1);
    }).filter(Boolean).join(" ");
  }
  const ticks = points.filter((_, index) => index % 4 === 0 || index === points.length - 1);
  return (
    <section className="fb-chart-main" aria-label={"Tren feedback " + semesterLabel}>
      <div className="fb-chart-head">
        <div>
          <div className="fb-chart-kicker">WEEKLY FEEDBACK TREND</div>
          <h2>Perbandingan Persepsi vs Kalibrasi</h2>
          <p>Akumulasi pengisian tiap minggu · {semesterLabel}</p>
        </div>
        <div className="fb-chart-meta">
          <span><strong>{totalEntries}</strong> feedback</span>
          <span className="fb-meta-divider" aria-hidden="true">·</span>
          <span><strong>{totalCalibrated}</strong> terkalibrasi</span>
        </div>
      </div>
      <div className="fb-chart-legend">
        <span><i className="fb-legend-swatch self" /> Self-Assessment</span>
        <span><i className="fb-legend-swatch verified" /> Supervisor Calibration</span>
      </div>
      {totalEntries === 0 ? (
        <div className="fb-chart-empty">
          <strong>Belum ada feedback pada {semesterLabel}</strong>
          <span>Grafik akan otomatis menampilkan tren setiap minggu setelah staf mengisi feedback.</span>
        </div>
      ) : (
        <div className="fb-chart-canvas">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img"
            aria-label={"Grafik garis rata-rata indeks persepsi dan supervisor dari setiap minggu selama " + semesterLabel}
            style={{display:"block",width:"100%",height:"100%",overflow:"visible"}}>
            {[1,2,3,4,5].map((v) => (
              <g key={v}>
                <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#e8edf7" strokeDasharray={v===1?"0":"4 6"} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                <text x={left-15} y={y(v)+4} textAnchor="end" fill="#68768e" fontSize="13">{v}</text>
              </g>
            ))}
            <path d={pathFor("self")} stroke="#75a9df" fill="none" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
            <path d={pathFor("calibrated")} stroke="#28388e" fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
            {points.map((p,i) => (
              <g key={p.weekStart}>
                {p.self !== null ? <circle cx={x(i)} cy={y(p.self)} r="4.6" fill="#75a9df" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                  <title>{p.label + ": Self " + labelScore(p.self) + " dari " + p.submissions + " pengisian"}</title>
                </circle> : null}
                {p.calibrated !== null ? <circle cx={x(i)} cy={y(p.calibrated)} r="4.6" fill="#28388e" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                  <title>{p.label + ": Kalibrasi " + labelScore(p.calibrated) + " dari " + p.calibrations + " validasi"}</title>
                </circle> : null}
              </g>
            ))}
            {ticks.map((p) => {
              const i = points.findIndex((item) => item.weekStart === p.weekStart);
              return <text key={p.weekStart} x={x(i)} y="285" fill="#68768e" textAnchor={i===0?"start":i===points.length-1?"end":"middle"} fontSize="12">{p.label}</text>;
            })}
          </svg>
        </div>
      )}
      <div className="fb-dimension-section">
        <div className="fb-dimension-title">Rerata per dimensi selama semester</div>
        <div className="fb-dimension-grid">
          {dimensions.map((dimension) => (
            <div className="fb-dimension-tile" key={dimension.label}>
              <div className="fb-dimension-top"><strong>{dimension.label}</strong><span>Skala 1–5</span></div>
              <div className="fb-mini-row"><span>Self</span><div className="fb-mini-track"><div className="fb-mini-fill self" style={{width:widthFor(dimension.self)}} /></div><strong>{labelScore(dimension.self)}</strong></div>
              <div className="fb-mini-row"><span>Kalibrasi</span><div className="fb-mini-track"><div className="fb-mini-fill verified" style={{width:widthFor(dimension.calibrated)}} /></div><strong>{labelScore(dimension.calibrated)}</strong></div>
            </div>
          ))}
        </div>
      </div>
      <p className="fb-chart-footnote">Nilai Self berasal dari seluruh pengisian; nilai kalibrasi hanya dari feedback yang sudah divalidasi. Minggu tanpa data tidak diberi nilai nol. Indeks tren memakai bobot Performance 50%, Contribution 30%, Collaboration 20% dan hanya untuk coaching — tidak masuk skor atau klasemen.</p>
    </section>
  );
}
