"use client";

import { FormEvent, useState } from "react";
import { createEmailLinkClient } from "@/lib/supabase/email-link-client";

const PRODUCTION_RESET_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    setLoading(true);
    const supabase = createEmailLinkClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PRODUCTION_RESET_CALLBACK,
    });
    setLoading(false);

    if (resetError) {
      setError(`Link reset password gagal dikirim: ${resetError.message}`);
      return;
    }

    setMessage(
      "Jika email memiliki akun aktif, link reset password sudah dikirim. Link dapat dibuka dari browser atau perangkat mana pun. Jika belum pernah aktivasi, gunakan menu Aktivasi Akun.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="form section">
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice ok">{message}</p> : null}
      <div className="field">
        <label>Email akun</label>
        <input name="email" type="email" required autoComplete="email" />
      </div>
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Mengirim..." : "Kirim Link Reset Password"}
      </button>
    </form>
  );
}
