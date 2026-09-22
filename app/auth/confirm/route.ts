import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_AUTH_DESTINATIONS = new Set(["/activate", "/reset-password", "/set-password"]);

function safeNext(value: string | null) {
  if (!value || !ALLOWED_AUTH_DESTINATIONS.has(value)) return "/set-password";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const redirectTo = new URL(next, request.url);
  redirectTo.search = "";

  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Password recovery is completed in the browser. The same browser that
  // requested the reset owns the PKCE verifier, so exchanging the code there
  // avoids verifier/cookie mismatches in a server callback.
  if (next === "/set-password") {
    if (code) {
      redirectTo.searchParams.set("code", code);
      if (flowId) redirectTo.searchParams.set("sb_flow_id", flowId);
      return NextResponse.redirect(redirectTo);
    }

    if (tokenHash && type) {
      redirectTo.searchParams.set("token_hash", tokenHash);
      redirectTo.searchParams.set("type", type);
      return NextResponse.redirect(redirectTo);
    }

    const providerError = searchParams.get("error_description") || searchParams.get("error");
    const message = providerError
      ? `Link reset password tidak dapat diverifikasi: ${providerError}`
      : "Link reset password tidak valid atau sudah kedaluwarsa. Silakan kirim ulang link reset password.";

    redirectTo.searchParams.set("error", message);
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) return NextResponse.redirect(redirectTo);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const message = next === "/activate"
    ? "Link aktivasi tidak valid atau sudah kedaluwarsa."
    : "Link autentikasi tidak valid atau sudah kedaluwarsa.";

  return NextResponse.redirect(
    new URL(`/set-password?error=${encodeURIComponent(message)}`, request.url),
  );
}
