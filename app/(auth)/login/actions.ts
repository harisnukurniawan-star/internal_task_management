"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/site-url";

const ACTIVATION_USERS = new Set([
  "system_admin",
  "harisnu_kurniawan",
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

  if (!ACTIVATION_USERS.has(userKey)) {
    activationError("Pilih nama user yang akan diaktifkan.");
  }
  if (!/^[a-z0-9._%+\-]+@gmail\.com$/.test(email)) {
    activationError("Aktivasi saat ini hanya menerima alamat @gmail.com.");
  }

  let origin: string;
  try {
    origin = await getAppOrigin();
  } catch {
    activationError("Alamat aplikasi tidak dapat ditentukan. Hubungi administrator.");
  }

  const supabase = await createClient();

  const { data: binding, error: bindingError } = await supabase.rpc("claim_activation_slot", {
    p_slot_key: userKey,
    p_email: email,
  });

  if (bindingError) {
    activationError(bindingError.message || "Gmail tidak dapat didaftarkan untuk user ini.");
  }

  const identity = Array.isArray(binding) ? binding[0] : null;
  if (!identity) {
    activationError("Identitas aktivasi tidak dapat diverifikasi.");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=/activate`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase().includes("not authorized")
      ? "Gmail sudah terdaftar ke user, tetapi layanan email Supabase belum mengizinkan pengiriman ke alamat ini. Konfigurasi custom SMTP masih diperlukan."
      : error.message.toLowerCase().includes("rate")
        ? "Gmail sudah terdaftar, tetapi batas pengiriman email sedang tercapai. Coba kembali beberapa saat lagi."
        : `Gmail sudah terdaftar, tetapi link aktivasi gagal dikirim: ${error.message}`;
    activationError(message);
  }

  redirect(`/login?activation_message=${encodeURIComponent(`Gmail ${email} sudah terdaftar untuk ${identity.full_name}. Link aktivasi telah diminta; cek Inbox dan Spam.`)}#activation`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
