import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_AUTH_DESTINATIONS = new Set(["/activate", "/reset-password"]);

function safeNext(value: string | null) {
  if (!value || !ALLOWED_AUTH_DESTINATIONS.has(value)) return "/reset-password";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const redirectTo = new URL(next, request.url);
  redirectTo.search = "";

  const supabase = await createClient();
  const code = searchParams.get("code");

  if (code) {
    const flowId = searchParams.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const message = next === "/activate"
    ? "Link aktivasi tidak valid atau sudah kedaluwarsa."
    : "Link reset password tidak valid atau sudah kedaluwarsa. Silakan kirim ulang link reset password.";

  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
  );
}
