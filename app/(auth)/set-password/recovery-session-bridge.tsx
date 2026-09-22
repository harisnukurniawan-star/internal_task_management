"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RecoverySessionBridge() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as EmailOtpType | null;

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!code && !(tokenHash && type) && !(accessToken && refreshToken)) return;

      setStatus("Memverifikasi link reset password...");
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
      }

      if (cancelled) return;

      if (authError) {
        setStatus(null);
        setError(`Link reset password gagal diverifikasi: ${authError.message}. Silakan kirim link reset baru.`);
        return;
      }

      window.history.replaceState({}, "", "/set-password");
      window.location.reload();
    }

    void establishRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="notice error">{error}</p>;
  if (status) return <p className="notice ok">{status}</p>;
  return null;
}
