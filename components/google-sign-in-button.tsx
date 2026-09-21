"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void | Promise<void>;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            },
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const completeSignIn = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) {
      setError("Google tidak mengembalikan credential login.");
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
    });

    if (signInError) {
      setBusy(false);
      setError(signInError.message);
      return;
    }

    const result = await fetch("/auth/google/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    if (!result.ok) {
      const payload = await result.json().catch(() => null) as { error?: string } | null;
      await supabase.auth.signOut();
      setBusy(false);
      setError(payload?.error ?? "Akun Google ini belum mendapat akses ke aplikasi.");
      return;
    }

    window.location.assign("/dashboard");
  }, []);

  const initializeGoogle = useCallback(() => {
    if (!clientId || !window.google?.accounts.id || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: completeSignIn,
    });

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 320,
      logo_alignment: "left",
    });
  }, [clientId, completeSignIn]);

  if (!clientId) {
    return (
      <p className="notice error">
        Google Sign-In belum dikonfigurasi. Administrator perlu memasang Google Client ID terlebih dahulu.
      </p>
    );
  }

  return (
    <div className="section">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={initializeGoogle}
      />
      <div style={{ display: "flex", justifyContent: "center", minHeight: 44 }}>
        <div ref={buttonRef} aria-label="Masuk dengan Google" />
      </div>
      {busy ? <p className="muted small" style={{ textAlign: "center" }}>Memverifikasi akun Google...</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
