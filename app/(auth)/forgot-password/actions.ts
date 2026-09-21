"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/site-url";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/forgot-password?error=${encodeURIComponent("Masukkan alamat email yang valid.")}`);
  }

  let origin: string;
  try {
    origin = await getAppOrigin();
  } catch {
    redirect(`/forgot-password?error=${encodeURIComponent("Alamat aplikasi tidak dapat ditentukan. Hubungi administrator.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent("Link reset password gagal dikirim. Coba lagi beberapa saat lagi.")}`);
  }

  redirect(`/forgot-password?message=${encodeURIComponent("Jika email terdaftar dan akun aktif, link reset password sudah dikirim. Periksa inbox dan folder spam.")}`);
}
