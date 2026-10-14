type StaffRadar = {
  id: string;
  name: string;
  self: [number | null, number | null, number | null];
  calibrated: [number | null, number | null, number | null];
  submissions: number;
  calibrations: number;
};

const LABELS = ["Performance", "Contribution", "Collaboration"] as const;
const CX = 180;
const CY = 143;
const RADIUS = 94;

function vertex(axis: number, radius: number) {
  const angle = -Math.PI / 2 + (axis * 2 * Math.PI) / 3;
  return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius] as const;
}
function polygonAt(level: number) {
  return [0, 1, 2]
    .map((axis) => vertex(axis, RADIUS * level / 5).map((n) => n.toFixed(2)).join(","))
    .join(" ");
}
function dataPolygon(values: [number | null, number | null, number | null]) {
  if (values.some((value) => value === null || !Number.isFinite(value))) return null;
  return values.map((value, axis) => vertex(axis, RADIUS * Math.max(0, Math.min(5, value ?? 0)) / 5)
    .map((n) => n.toFixed(2)).join(",")).join(" ");
}
function score(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

export function EmployeeRadarDashboard({
  staff, semesterLabel,
}: {
  staff: StaffRadar[];
  semesterLabel: string;
}) {
  return (
    <div className="wf-radar-root">
      <div className="wf-radar-heading">
        <div>
          <div className="wf-radar-kicker">WEEKLY CALIBRATION · RADAR OVERVIEW</div>
          <h2>Perbandingan Self-Assessment dan Kalibrasi Atasan</h2>
          <p>Rerata Performance, Contribution, dan Collaboration per staf · {semesterLabel}</p>
        </div>
        <div className="wf-radar-scale">Skala 1–5</div>
      </div>

      {staff.length === 0 ? (
        <div className="wf-radar-empty-all">Belum ada staf aktif untuk ditampilkan.</div>
      ) : (
        <div className="wf-radar-grid">
          {staff.map((person) => {
            const selfShape = dataPolygon(person.self);
            const calibratedShape = dataPolygon(person.calibrated);
            return (
              <section key={person.id} className="wf-radar-card" aria-label={"Radar " + person.name}>
                <div className="wf-radar-card-head">
                  <h3 title={person.name}>{person.name}</h3>
                  <span>{person.submissions} feedback · {person.calibrations} terkalibrasi</span>
                </div>
                <div className="wf-radar-chart">
                  <svg viewBox="0 0 360 286" role="img"
                    aria-label={
                      person.name + ": Self-Assessment " + person.self.map(score).join(", ") +
                      "; Kalibrasi " + person.calibrated.map(score).join(", ")
                    }>
                    <title>{person.name + " — spider web diagram " + semesterLabel}</title>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <polygon
                        key={level}
                        points={polygonAt(level)}
                        fill={level % 2 === 0 ? "#f9fbff" : "transparent"}
                        stroke={level === 5 ? "#b4c2db" : "#e2e8f2"}
                        strokeWidth={level === 5 ? "1.6" : "1.1"}
                      />
                    ))}
                    {[0, 1, 2].map((axis) => {
                      const [x, y] = vertex(axis, RADIUS);
                      return <line key={axis} x1={CX} y1={CY} x2={x} y2={y}
                        stroke="#d4dfef" strokeWidth="1.1"/>;
                    })}
                    {[1, 3, 5].map((v) => (
                      <text key={v} x={CX + 7} y={CY - RADIUS * v / 5 + 3}
                        fontSize="10" fill="#8b99b1">{v}</text>
                    ))}

                    {selfShape ? (
                      <polygon points={selfShape}
                        fill="#77afe2" fillOpacity="0.23"
                        stroke="#6ca6de" strokeWidth="3" strokeLinejoin="round"/>
                    ) : null}
                    {calibratedShape ? (
                      <polygon points={calibratedShape}
                        fill="#28388e" fillOpacity="0.19"
                        stroke="#28388e" strokeWidth="3.1" strokeLinejoin="round"/>
                    ) : null}
                    {person.self.map((v, axis) => v === null ? null : (
                      <circle key={"s" + axis} cx={vertex(axis, RADIUS * v / 5)[0]}
                        cy={vertex(axis, RADIUS * v / 5)[1]} r="3.7"
                        fill="#77afe2" stroke="#fff" strokeWidth="1.4">
                        <title>{LABELS[axis] + " — Self " + score(v)}</title>
                      </circle>
                    ))}
                    {person.calibrated.map((v, axis) => v === null ? null : (
                      <circle key={"c" + axis} cx={vertex(axis, RADIUS * v / 5)[0]}
                        cy={vertex(axis, RADIUS * v / 5)[1]} r="3.9"
                        fill="#28388e" stroke="#fff" strokeWidth="1.4">
                        <title>{LABELS[axis] + " — Atasan " + score(v)}</title>
                      </circle>
                    ))}
                    <text x="180" y="24" fontSize="12" fontWeight="700" textAnchor="middle" fill="#35436b">Performance</text>
                    <text x="299" y="226" fontSize="12" fontWeight="700" textAnchor="middle" fill="#35436b">Contribution</text>
                    <text x="61" y="226" fontSize="12" fontWeight="700" textAnchor="middle" fill="#35436b">Collaboration</text>
                  </svg>
                </div>

                <div className="wf-radar-card-bottom">
                  <div className="wf-radar-legend">
                    <span><i className="wf-radar-key self"/> Self-Assessment</span>
                    <span><i className="wf-radar-key supervisor"/> Kalibrasi Atasan</span>
                  </div>
                  {person.submissions === 0 ? (
                    <p className="wf-radar-no-data">Belum ada feedback pada periode ini.</p>
                  ) : person.calibrations === 0 ? (
                    <p className="wf-radar-pending">Self-Assessment tersedia · Menunggu kalibrasi lengkap (3/3)</p>
                  ) : (
                    <p className="wf-radar-pending">Rerata semester · {person.calibrations} feedback sudah dikalibrasi lengkap</p>
                  )}
                  <div className="wf-radar-values">
                    <div className="wf-radar-value-label">Dimensi</div>
                    {LABELS.map((label) => <div className="wf-radar-value-heading" key={label}>{label}</div>)}
                    <div className="wf-radar-value-label"><i className="wf-radar-key self"/> Self</div>
                    {person.self.map((v, i) => <strong key={"self" + i}>{score(v)}</strong>)}
                    <div className="wf-radar-value-label"><i className="wf-radar-key supervisor"/> Atasan</div>
                    {person.calibrated.map((v, i) => <strong key={"supervisor" + i}>{score(v)}</strong>)}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="wf-radar-note">
        Nilai Self adalah rerata seluruh feedback staf dalam semester terpilih. Nilai Atasan menggunakan
        feedback yang telah dikalibrasi lengkap (3/3 dimensi); sampel kedua seri dapat berbeda.
        Data yang belum ada ditampilkan sebagai kosong, bukan nol.
        Grafik ini hanya untuk coaching, tanpa pengaruh terhadap skor tugas, KPI, atau klasemen.
      </p>
    </div>
  );
}
