"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PRODUCTION_RESET_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/forgot-password?error=${encodeURIComponent("Masukkan alamat email yang valid.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PRODUCTION_RESET_CALLBACK,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("Link reset password gagal dikirim. Coba lagi beberapa saat lagi.")}`);
  }

  redirect(`/forgot-password?message=${encodeURIComponent("Jika email terdaftar dan akun aktif, link reset password sudah dikirim. Periksa inbox dan folder spam.")}`);
}
