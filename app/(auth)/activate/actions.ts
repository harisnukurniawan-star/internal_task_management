"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");

  if (password.length < 8) {
    redirect(`/activate?error=${encodeURIComponent("Password minimal 8 karakter.")}`);
  }
  if (password !== confirmation) {
    redirect(`/activate?error=${encodeURIComponent("Konfirmasi password tidak sama.")}`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent("Sesi aktivasi tidak valid atau sudah kedaluwarsa.")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.active) {
    redirect(`/login?error=${encodeURIComponent("Akun belum diaktifkan oleh administrator.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/activate?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
