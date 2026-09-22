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
    redirect(`/set-password?error=${encodeURIComponent("Sesi dari link email tidak valid atau sudah kedaluwarsa. Silakan buka link terbaru dari email.")}`);
  }

  const { data: activationState, error: activationStateError } = await supabase.rpc(
    "get_my_activation_state",
  );

  if (activationStateError) {
    redirect(`/set-password?error=${encodeURIComponent("Status akun tidak dapat diverifikasi. Silakan buka ulang link email terbaru.")}`);
  }

  const isPendingActivation = activationState === "pending";

  if (!isPendingActivation) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.active) {
      await supabase.auth.signOut();
      redirect(`/set-password?error=${encodeURIComponent("Akun belum aktif. Gunakan menu Aktivasi akun dari halaman Login.")}`);
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/set-password?error=${encodeURIComponent(`Password gagal diperbarui: ${error.message}`)}`);
  }

  if (isPendingActivation) {
    const { data: completion, error: completionError } = await supabase.rpc(
      "complete_email_activation",
    );

    if (completionError || (completion !== "activated" && completion !== "already_active")) {
      redirect(`/set-password?error=${encodeURIComponent("Password berhasil dibuat, tetapi finalisasi aktivasi gagal. Buka ulang link aktivasi terbaru atau hubungi administrator.")}`);
    }

    redirect("/dashboard");
  }

  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent("Password berhasil diperbarui. Silakan masuk menggunakan password baru.")}`);
}
