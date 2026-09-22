"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PRODUCTION_RESET_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

export async function requestPasswordReset(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    redirect(`/forgot-password?error=${encodeURIComponent("Masukkan username yang valid.")}`);
  }

  const supabase = await createClient();
  const { data: email, error: resolveError } = await supabase.rpc("resolve_auth_email", {
    p_username: username,
  });

  if (!resolveError && email) {
    await supabase.auth.resetPasswordForEmail(String(email), {
      redirectTo: PRODUCTION_RESET_CALLBACK,
    });
  }

  redirect(`/forgot-password?message=${encodeURIComponent("Jika username terdaftar dan akun aktif, link reset password sudah dikirim ke email recovery akun.")}`);
}
