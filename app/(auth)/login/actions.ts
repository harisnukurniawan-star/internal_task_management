"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACTIVATION_USERS = new Set([
  "system_admin",
  "endang_mirah_ayu",
  "citra_aries",
  "heri_syamsudin",
]);

function activationError(message: string): never {
  redirect(`/login?activation_error=${encodeURIComponent(message)}#activation`);
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function requestActivation(formData: FormData) {
  const userKey = String(formData.get("activation_user") || "").trim();
  const email = String(formData.get("activation_email") || "").trim().toLowerCase();
  const password = String(formData.get("activation_password") || "");
  const confirmation = String(formData.get("activation_password_confirmation") || "");

  if (!ACTIVATION_USERS.has(userKey)) {
    activationError("Pilih user baru yang akan diaktifkan.");
  }
  if (!/^[a-z0-9._%+\-]+@gmail\.com$/.test(email)) {
    activationError("Aktivasi hanya menerima alamat @gmail.com.");
  }
  if (password.length < 8) {
    activationError("Password minimal 8 karakter.");
  }
  if (password !== confirmation) {
    activationError("Konfirmasi password tidak sama.");
  }

  const supabase = await createClient();
  const signupGrant = `${randomUUID()}-${randomUUID()}`;

  const { data: binding, error: bindingError } = await supabase.rpc("claim_activation_slot", {
    p_slot_key: userKey,
    p_email: email,
    p_signup_grant: signupGrant,
  });

  if (bindingError) {
    activationError(bindingError.message || "Akun tidak dapat diaktifkan.");
  }

  const identity = Array.isArray(binding) ? binding[0] : null;
  if (!identity) {
    activationError("Identitas aktivasi tidak dapat diverifikasi.");
  }

  // Activation is intentionally independent from any stale login session in the browser.
  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        activation_slot: userKey,
        activation_grant: signupGrant,
      },
    },
  });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already been registered")) {
      activationError("Gmail ini sudah mempunyai akun login. Silakan gunakan halaman Masuk.");
    }
    if (lower.includes("confirmation") || lower.includes("sending") || lower.includes("email")) {
      activationError("Supabase masih mencoba mengirim email konfirmasi. Matikan Confirm email di Authentication > Sign In / Providers > Email, lalu coba lagi.");
    }
    activationError(error.message || "Aktivasi akun gagal.");
  }

  // With Confirm email disabled, signUp returns a session immediately.
  // Try password sign-in once as a defensive fallback before reporting a configuration issue.
  if (!data.session) {
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) {
      activationError("Akun dibuat tetapi Supabase masih mewajibkan konfirmasi email. Matikan Confirm email lalu coba login kembali.");
    }
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
