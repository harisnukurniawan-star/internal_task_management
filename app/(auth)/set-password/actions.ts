"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");

  if (password.length < 8) {
    redirect(`/set-password?error=${encodeURIComponent("Password minimal 8 karakter.")}`);
  }

  if (password !== confirmation) {
    redirect(`/set-password?error=${encodeURIComponent("Konfirmasi password tidak sama.")}`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/set-password?error=${encodeURIComponent("Sesi reset password tidak valid atau sudah kedaluwarsa. Silakan buka kembali link terbaru dari email.")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect(`/set-password?error=${encodeURIComponent("Akun belum aktif. Hubungi administrator.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/set-password?error=${encodeURIComponent("Password gagal diperbarui. Silakan coba lagi.")}`);
  }

  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent("Password berhasil diperbarui. Silakan masuk menggunakan password baru.")}`);
}
