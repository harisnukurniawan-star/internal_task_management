"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const QUESTIONS = [
  { label: "Performance", statement: "Saya merasa puas dengan pencapaian pekerjaan saya minggu ini." },
  { label: "Contribution", statement: "Saya merasa pekerjaan saya minggu ini memberikan manfaat nyata bagi tim." },
  { label: "Collaboration", statement: "Saya merasa telah memberikan dukungan yang berarti bagi rekan kerja minggu ini." },
] as const;

type Phase = "checking" | "required" | "complete";
export function WeeklyFeedbackGate({ weekStart }: { weekStart: string }) {
  const supabase = useMemo(() => createClient(), []);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([0, 0, 0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inspect = useCallback(async () => {
    setPhase("checking");
    setError("");
    const { data: employee, error: employeeError } = await supabase
      .from("employees").select("id").eq("active", true)
      .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();
    if (employeeError || !employee) {
      setError("Profil staf belum tertaut atau tidak dapat dimuat. Hubungi administrator.");
      setPhase("required");
      return;
    }
    setEmployeeId(employee.id);
    const { data, error: queryError } = await supabase
      .from("weekly_feedback").select("id")
      .eq("employee_id", employee.id).eq("week_start", weekStart).maybeSingle();
    if (queryError) {
      setError("Riwayat feedback belum dapat diperiksa. Coba lagi.");
      setPhase("required");
      return;
    }
    setPhase(data ? "complete" : "required");
  }, [supabase, weekStart]);

  useEffect(() => { void inspect(); }, [inspect]);

  useEffect(() => {
    if (phase === "complete") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [phase]);

  // Keep keyboard interaction within the mandatory dialog until submitted.
  useEffect(() => {
    if (phase === "complete") return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      )).filter((item) => item.getClientRects().length > 0);
      if (!items.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [phase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !employeeId || scores.some((value) => value < 1 || value > 5)) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("weekly_feedback").insert({
      employee_id: employeeId, week_start: weekStart,
      performance: scores[0], contribution: scores[1], collaboration: scores[2],
    });
    if (!insertError) {
      setPhase("complete");
    } else {
      // Another tab may have successfully submitted the same week.
      const { data } = await supabase.from("weekly_feedback").select("id")
        .eq("employee_id", employeeId).eq("week_start", weekStart).maybeSingle();
      if (data) setPhase("complete");
      else setError("Feedback belum berhasil disimpan. Silakan coba lagi.");
    }
    setSaving(false);
  }

  if (phase === "complete") return null;
  return (
    <div className="wf-overlay" role="presentation">
      <style>{".wf-overlay{position:fixed;inset:0;z-index:5000;background:rgba(18,27,65,.70);display:flex;align-items:center;justify-content:center;padding:16px}.wf-modal{width:min(610px,100%);max-height:92dvh;overflow:auto;border:1px solid #e0e4f2;background:#fff;border-radius:16px;box-shadow:0 24px 90px #101d4655;padding:20px 24px;color:#18213d}.wf-kicker{font-size:10px;font-weight:800;letter-spacing:.11em;color:#2a3587;text-transform:uppercase}.wf-modal h2{font-size:20px;margin:5px 0 5px;color:#24307b}.wf-sub{font-size:12px;line-height:1.55;color:#667085;margin:0 0 14px}.wf-question{padding:11px 0;border-top:1px solid #e7eaf2}.wf-question strong{font-size:12px;color:#24307b}.wf-question p{font-size:13px;margin:5px 0 8px;line-height:1.4}.wf-scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.wf-scale label{cursor:pointer;display:flex;align-items:center;justify-content:center;border:1px solid #d9dfef;border-radius:9px;padding:8px;background:#fff;color:#24307b;font-weight:700;font-size:13px}.wf-scale label:has(input:checked){background:#2a3587;color:#fff;border-color:#2a3587}.wf-scale input{position:absolute;opacity:0;width:1px;height:1px}.wf-scale label:focus-within{outline:2px solid #91a0ed;outline-offset:2px}.wf-labels{display:flex;justify-content:space-between;margin-top:5px;font-size:10px;color:#8490a3}.wf-submit{width:100%;margin-top:10px;padding:11px;border:0;border-radius:9px;background:#2a3587;color:white;font-weight:800;cursor:pointer}.wf-submit:disabled{background:#a5acc8;cursor:not-allowed}.wf-error{font-size:12px;color:#b42318;margin:8px 0}.wf-retry{color:#24307b;border:1px solid #d9dfef;border-radius:8px;background:white;padding:9px 15px;cursor:pointer}.wf-info{padding:10px;background:#f4f5ff;border-radius:9px;color:#45537b;font-size:11px;line-height:1.5;margin-bottom:4px}"} </style>
      <section ref={dialogRef} tabIndex={-1} className="wf-modal" role="dialog" aria-modal="true" aria-labelledby="wf-title" aria-describedby="wf-description">
        <div className="wf-kicker">Weekly Feedback · Kamis & Jumat</div>
        <h2 id="wf-title">Refleksi Mingguan</h2>
        <p className="wf-sub" id="wf-description">Luangkan sekitar 1 menit untuk merefleksikan minggu ini. Isi sekali saja setiap minggu; setelah terkirim, pop-up tidak muncul lagi.</p>
        {phase === "checking" ? <p className="wf-sub" role="status">Memeriksa status pengisian minggu ini...</p> : (
          <>
            <div className="wf-info">Jawaban hanya untuk feedback dan coaching. Tidak memengaruhi penilaian tugas, skor KPI, atau klasemen.</div>
            {employeeId && !error.startsWith("Riwayat feedback") ? (
              <form onSubmit={submit}>
                {QUESTIONS.map((question, index) => (
                  <div className="wf-question" key={question.label}>
                    <strong>{index + 1}. {question.label}</strong>
                    <p>{question.statement}</p>
                    <div className="wf-scale" role="radiogroup" aria-label={question.label}>
                      {[1,2,3,4,5].map((value) => (
                        <label key={value}>
                          <input type="radio" name={question.label} value={value} required
                            checked={scores[index] === value} disabled={saving}
                            onChange={() => setScores((old) => old.map((score, i) => i === index ? value : score))} />
                          {value}
                        </label>
                      ))}
                    </div>
                    <div className="wf-labels"><span>Sangat Tidak Sesuai</span><span>Sangat Sesuai</span></div>
                  </div>
                ))}
                {error ? <p className="wf-error" role="alert">{error}</p> : null}
                <button className="wf-submit" type="submit" disabled={saving || scores.some((score) => score === 0)}>
                  {saving ? "Menyimpan..." : "Kirim Feedback Mingguan"}
                </button>
              </form>
            ) : (
              <>
                {error ? <p className="wf-error" role="alert">{error}</p> : null}
                <button className="wf-retry" onClick={() => void inspect()} type="button">Coba lagi</button>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
