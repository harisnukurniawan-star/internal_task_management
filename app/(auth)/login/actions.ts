"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/site-url";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function requestActivation(formData: FormData) {
  const email = String(formData.get("activation_email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/login?activation_error=${encodeURIComponent("Isi email tujuan aktivasi yang valid.")}#activation`);
  }

  let origin: string;
  try {
    origin = await getAppOrigin();
  } catch {
    redirect(`/login?activation_error=${encodeURIComponent("Alamat aplikasi tidak dapat ditentukan. Hubungi administrator.")}#activation`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/activate`,
  });

  if (error) {
    redirect(`/login?activation_error=${encodeURIComponent("Link aktivasi gagal dikirim. Coba lagi atau hubungi administrator.")}#activation`);
  }

  redirect(`/login?activation_message=${encodeURIComponent("Jika email terdaftar, link aktivasi / pembuatan password sudah dikirim ke email tujuan.")}#activation`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
