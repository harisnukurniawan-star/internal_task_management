"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function weekLabel(weekStart: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(weekStart + "T00:00:00Z"));
}

// Mandatory reminder only: the assessment form lives on /weekly-feedback.
// The reminder intentionally has no close/dismiss action while feedback is due.
export function WeeklyFeedbackGate({ weekStart }: { weekStart: string }) {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const visible = pathname !== "/weekly-feedback";

  useEffect(() => {
    if (!visible) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", trap, true);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", trap, true);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(18,27,65,.72)", display: "grid", placeItems: "center", padding: 16 }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="feedback-reminder-title" aria-describedby="feedback-reminder-body"
        style={{ width: "min(440px,100%)", border: "1px solid #e0e4f2", borderRadius: 16, padding: "24px", background: "#fff", boxShadow: "0 24px 80px #101d4655", color: "#24307b" }}>
        <span style={{ color: "#3447a0", fontWeight: 800, fontSize: 11, letterSpacing: ".08em" }}>WAJIB · WEEKLY SELF-ASSESSMENT</span>
        <h2 id="feedback-reminder-title" style={{ margin: "8px 0", fontSize: 20 }}>Reminder Pengisian Feedback</h2>
        <p id="feedback-reminder-body" style={{ fontSize: 13, lineHeight: 1.6, color: "#56627c" }}>
          Anda sudah mengirim tugas pada minggu mulai <strong>{weekLabel(weekStart)}</strong>, tetapi feedback self-assessment belum dikirim.
          Pengisian wajib diselesaikan untuk periode tersebut. Setelah berhasil disubmit, reminder akan nonaktif.
        </p>
        <Link ref={buttonRef} href={"/weekly-feedback?week=" + encodeURIComponent(weekStart)}
          style={{ marginTop: 18, display: "block", textAlign: "center", background: "#2a3587", color: "#fff", borderRadius: 9, fontWeight: 800, padding: "11px 14px", textDecoration: "none" }}>
          OK · Isi Feedback
        </Link>
      </section>
    </div>
  );
}
