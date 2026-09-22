"use server";

import { redirect } from "next/navigation";
import { createEmailLinkClient } from "@/lib/supabase/email-link-client";

const PRODUCTION_RESET_CALLBACK =
  "https://internaltaskmanagement.vercel.app/auth/confirm?next=/set-password";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/forgot-password?error=${encodeURIComponent("Masukkan alamat email yang valid.")}`);
  }

  // Request email link dengan implicit flow agar link dapat dibuka dari
  // browser/perangkat lain tanpa bergantung pada PKCE code_verifier.
  const supabase = createEmailLinkClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PRODUCTION_RESET_CALLBACK,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("Link reset password gagal dikirim. Coba lagi beberapa saat lagi.")}`);
  }

  redirect(`/forgot-password?message=${encodeURIComponent("Jika email terdaftar, link terbaru sudah dikirim. Gunakan hanya email yang paling baru karena link sebelumnya otomatis tidak berlaku.")}`);
}
