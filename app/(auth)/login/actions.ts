"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function activationError(message: string): never {
  redirect(`/login?activation_error=${encodeURIComponent(message)}#activation`);
}

function normalizeUsername(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

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

export async function requestActivation(formData: FormData) {
  const username = normalizeUsername(formData.get("activation_username"));
  const password = String(formData.get("activation_password") || "");
  const confirmation = String(formData.get("activation_password_confirmation") || "");

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    activationError("Masukkan username yang diberikan administrator.");
  }
  if (password.length < 8) {
    activationError("Password minimal 8 karakter.");
  }
  if (password !== confirmation) {
    activationError("Konfirmasi password tidak sama.");
  }

  const supabase = await createClient();
  const signupGrant = `${randomUUID()}-${randomUUID()}`;

  const { data: binding, error: bindingError } = await supabase.rpc("claim_activation_username", {
    p_username: username,
    p_signup_grant: signupGrant,
  });

  if (bindingError) {
    const msg = bindingError.message || "Akun tidak dapat diaktifkan.";
    if (msg.toLowerCase().includes("email user belum didaftarkan")) {
      activationError("Email recovery user belum didaftarkan administrator. Hubungi admin terlebih dahulu.");
    }
    activationError(msg);
  }

  const identity = Array.isArray(binding) ? binding[0] : null;
  if (!identity?.email || !identity?.slot_key) {
    activationError("Identitas aktivasi tidak dapat diverifikasi.");
  }

  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signUp({
    email: String(identity.email),
    password,
    options: {
      data: {
        activation_slot: String(identity.slot_key),
        activation_grant: signupGrant,
      },
    },
  });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already been registered")) {
      activationError("Akun login untuk user ini sudah ada. Silakan gunakan halaman Masuk.");
    }
    if (lower.includes("rate limit")) {
      activationError("Batas percobaan Auth sementara tercapai. Tunggu sebentar lalu coba lagi.");
    }
    if (lower.includes("email signups are disabled")) {
      activationError("Email signup Supabase masih nonaktif. Aktifkan Email provider dan Allow new users to sign up.");
    }
    activationError(`Aktivasi gagal: ${error.message}`);
  }

  if (!data.session) {
    const signIn = await supabase.auth.signInWithPassword({
      email: String(identity.email),
      password,
    });
    if (signIn.error) {
      activationError(`Akun dibuat tetapi sesi login belum terbentuk: ${signIn.error.message}`);
    }
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
