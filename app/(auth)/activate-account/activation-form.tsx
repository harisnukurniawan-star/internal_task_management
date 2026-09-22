"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PRODUCTION_ACTIVATION_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

type ActivationBinding = {
  slot_key: string;
  email: string;
  binding_status: "ready" | "resend" | string;
};

function friendlyActivationError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("sudah aktif")) {
    return "Akun untuk email ini sudah aktif. Silakan masuk atau gunakan Lupa Password.";
  }
  if (lower.includes("belum terdaftar")) {
    return "Email belum terdaftar untuk aktivasi. Hubungi administrator.";
  }
  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Link aktivasi baru saja diminta. Tunggu sebentar lalu coba lagi jika email belum masuk.";
  }
  if (lower.includes("grant aktivasi")) {
    return "Permintaan aktivasi kedaluwarsa. Silakan kirim ulang link aktivasi.";
  }
  return "Aktivasi belum dapat diproses. Silakan coba lagi atau hubungi administrator.";
}

export function ActivationForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const signupGrant = `${crypto.randomUUID()}-${crypto.randomUUID()}`;

      const { data: bindingData, error: bindingError } = await supabase.rpc(
        "claim_activation_email",
        {
          p_email: email,
          p_signup_grant: signupGrant,
        },
      );

      if (bindingError) {
        throw new Error(bindingError.message || "Akun tidak dapat diaktivasi.");
      }

      const identity = (Array.isArray(bindingData) ? bindingData[0] : null) as ActivationBinding | null;
      if (!identity?.slot_key || !identity?.email) {
        throw new Error("Data aktivasi tidak dapat diverifikasi.");
      }

      const isNewAuthUser = identity.binding_status !== "resend";
      const { error: emailError } = await supabase.auth.signInWithOtp({
        email: identity.email,
        options: isNewAuthUser
          ? {
              shouldCreateUser: true,
              emailRedirectTo: PRODUCTION_ACTIVATION_CALLBACK,
              data: {
                activation_slot: identity.slot_key,
                activation_grant: signupGrant,
                activation_mode: "email_link",
              },
            }
          : {
              shouldCreateUser: false,
              emailRedirectTo: PRODUCTION_ACTIVATION_CALLBACK,
            },
      });

      if (emailError) {
        throw new Error(emailError.message || "Link aktivasi gagal dikirim.");
      }

      setMessage(
        "Link aktivasi sudah dikirim. Buka email terbaru, klik link Aktivasi Akun, lalu buat password di halaman berikutnya.",
      );
      form.reset();
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "Aktivasi gagal. Silakan coba lagi.";
      setError(friendlyActivationError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form section">
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice ok">{message}</p> : null}

      <div className="field">
        <label>Email akun</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@gmail.com"
        />
      </div>

      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Mengirim..." : "Aktivasi Akun"}
      </button>
    </form>
  );
}
