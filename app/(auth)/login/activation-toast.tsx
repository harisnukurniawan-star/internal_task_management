"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ActivationToast({ type, message }: { type?: "success" | "error"; message?: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(type && message));

  useEffect(() => {
    if (!type || !message) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => router.replace("/login", { scroll: false }), 250);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [type, message, router]);

  if (!visible || !type || !message) return null;

  return (
    <div className={`activation-toast ${type}`} role="status" aria-live="polite">
      <div className="activation-toast-icon" aria-hidden="true">{type === "success" ? "✓" : "!"}</div>
      <div className="activation-toast-copy">
        <strong>{type === "success" ? "Link aktivasi terkirim" : "Pengiriman gagal"}</strong>
        <span>{message}</span>
        {type === "success" ? <small>Cek Inbox, Promotions, atau Spam di email tujuan.</small> : null}
      </div>
      <button type="button" className="activation-toast-close" onClick={() => setVisible(false)} aria-label="Tutup notifikasi">×</button>
    </div>
  );
}
