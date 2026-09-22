"use client";

import { FormEvent, useState } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const ACTIVATION_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

type ActivationBinding = {
  slot_key: string;
  full_name: string;
  role: string;
  email: string;
  binding_status: "ready" | "resend" | string;
};

function friendlyActivationError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("security purposes")) {
    return "Link aktivasi baru saja diminta. Tunggu sebentar lalu kirim ulang jika email belum masuk.";
  }
  if (lower.includes("email user belum didaftarkan")) {
    return "Email user belum didaftarkan administrator. Hubungi admin terlebih dahulu.";
  }
  if (lower.includes("sudah aktif")) {
    return "Akun ini sudah aktif. Silakan gunakan halaman Masuk.";
  }
  if (lower.includes("username tidak ditemukan")) {
    return "Username tidak ditemukan atau belum diaktifkan administrator.";
  }
  return message;
}

export function ActivationModal({ error: initialError, message: initialMessage }: { error?: string; message?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [message, setMessage] = useState<string | null>(initialMessage || null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("activation_username") || "").trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      setError("Masukkan username yang diberikan administrator.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: {
            flowType: "implicit",
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );

      const signupGrant = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const { data: bindingData, error: bindingError } = await supabase.rpc(
        "claim_activation_username",
        {
          p_username: username,
          p_signup_grant: signupGrant,
        },
      );

      if (bindingError) {
        throw new Error(bindingError.message || "Akun tidak dapat diaktivasi.");
      }

      const identity = (Array.isArray(bindingData) ? bindingData[0] : null) as ActivationBinding | null;
      if (!identity?.email || !identity?.slot_key) {
        throw new Error("Identitas aktivasi tidak dapat diverifikasi.");
      }

      const isNewAuthUser = identity.binding_status !== "resend";
      const otpOptions = isNewAuthUser
        ? {
            shouldCreateUser: true,
            emailRedirectTo: ACTIVATION_CALLBACK,
            data: {
              activation_slot: identity.slot_key,
              activation_grant: signupGrant,
              activation_mode: "email_link",
            },
          }
        : {
            shouldCreateUser: false,
            emailRedirectTo: ACTIVATION_CALLBACK,
          };

      const { error: emailError } = await supabase.auth.signInWithOtp({
        email: identity.email,
        options: otpOptions,
      });

      if (emailError) {
        throw new Error(emailError.message || "Link aktivasi gagal dikirim.");
      }

      event.currentTarget.reset();
      setMessage(
        "Link aktivasi sudah dikirim ke Gmail yang terdaftar. Buka email terbaru, klik link aktivasi, lalu buat password di aplikasi.",
      );
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "Aktivasi gagal. Silakan coba lagi.";
      setError(friendlyActivationError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Masukkan username. Link aktivasi akan dikirim ke Gmail yang sudah didaftarkan administrator.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form onSubmit={onSubmit} className="form section-sm">
          <div className="field">
            <label>Username</label>
            <input
              name="activation_username"
              type="text"
              required
              autoComplete="username"
              inputMode="text"
              placeholder="contoh: heri"
              pattern="[a-zA-Z0-9._-]{3,40}"
              title="Gunakan username yang diberikan administrator"
            />
            <small className="muted">Email dan role tetap mengikuti source of truth di database.</small>
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Mengirim..." : "Kirim Link Aktivasi"}
          </button>
          <a className="btn secondary activation-cancel" href="#">Batal</a>
        </form>
      </section>
    </div>
  );
}
