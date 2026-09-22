"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ActivationToast({ type, message }: { type?: "success" | "error"; message?: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(type && message));

  const dismiss = () => {
    setVisible(false);
    router.replace("/login", { scroll: false });
  };

  useEffect(() => {
    if (!type || !message) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      dismiss();
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, message]);

  if (!visible || !type || !message) return null;

  return (
    <div className={`activation-toast ${type}`} role="status" aria-live="polite">
      <div className="activation-toast-icon" aria-hidden="true">{type === "success" ? "✓" : "!"}</div>
      <div className="activation-toast-copy">
        <strong>{type === "success" ? "Aktivasi berhasil" : "Aktivasi gagal"}</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="activation-toast-close" onClick={dismiss} aria-label="Tutup notifikasi">×</button>
    </div>
  );
}
