"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_DESTINATIONS = new Set(["/set-password"]);

function safeNext(value: string | null) {
  if (!value || !ALLOWED_DESTINATIONS.has(value)) return "/set-password";
  return value;
}

function friendlyConfirmError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("pkce code verifier not found")) {
    return "Link ini dibuat dengan metode aktivasi lama dan tidak dapat dibuka dari browser/perangkat ini. Kembali ke halaman Aktivasi Akun dan kirim link baru, lalu buka email terbaru.";
  }
  if (lower.includes("expired") || lower.includes("invalid")) {
    return "Link email tidak valid atau sudah kedaluwarsa. Silakan kirim ulang link dan gunakan email terbaru.";
  }
  return "Link email gagal diverifikasi. Silakan kirim ulang link terbaru lalu coba lagi.";
}

export default function AuthConfirmPage() {
  const [status, setStatus] = useState("Memverifikasi link email...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function confirm() {
      const url = new URL(window.location.href);
      const next = safeNext(url.searchParams.get("next"));
      const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

      if (providerError) {
        setError(friendlyConfirmError(providerError));
        setStatus("");
        return;
      }

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as EmailOtpType | null;
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      const supabase = createClient();
      let authError: { message: string } | null = null;

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        authError = result.error;
      } else if (tokenHash && type) {
        const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        authError = result.error;
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        authError = result.error;
      } else {
        setError("Link email tidak valid atau sudah kedaluwarsa. Minta link terbaru lalu coba lagi.");
        setStatus("");
        return;
      }

      if (cancelled) return;

      if (authError) {
        setError(friendlyConfirmError(authError.message));
        setStatus("");
        return;
      }

      setStatus("Link berhasil diverifikasi. Membuka halaman pembuatan password...");
      window.history.replaceState({}, "", "/auth/confirm");
      window.location.replace(next);
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="login">
      <section className="login-card">
        <h1>Verifikasi Akun</h1>
        {status ? <p className="notice ok">{status}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        {error ? (
          <div className="section-sm">
            <a className="btn secondary" href="/activate-account">Kirim Link Aktivasi Baru</a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
