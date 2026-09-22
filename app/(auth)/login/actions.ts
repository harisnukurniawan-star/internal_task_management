"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function loginErrorMessage(error: { code?: string; message?: string }) {
  const code = String(error.code || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Password tidak cocok dengan akun tersebut. Gunakan Lupa password bila perlu membuat password baru.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Email akun belum terkonfirmasi di Supabase Auth.";
  }
  if (code.includes("rate") || message.includes("rate limit")) {
    return "Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.";
  }
  if (message.includes("email logins are disabled") || message.includes("provider is not enabled")) {
    return "Login Email di Supabase Auth sedang nonaktif. Aktifkan Email provider terlebih dahulu.";
  }
  if (message.includes("banned") || message.includes("disabled")) {
    return "Akun sedang dinonaktifkan di Supabase Auth.";
  }

  const safeCode = error.code ? ` (${error.code})` : "";
  return `Login gagal${safeCode}. Silakan coba lagi atau gunakan Lupa password.`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    redirect(`/login?error=${encodeURIComponent("Masukkan email dan password yang valid.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(loginErrorMessage(error))}`);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
