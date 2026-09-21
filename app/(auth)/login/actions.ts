"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const requestHeaders = await headers();
  const rawOrigin = requestHeaders.get("origin");
  let origin = "";

  if (rawOrigin) {
    try {
      const parsed = new URL(rawOrigin);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") origin = parsed.origin;
    } catch {}
  }

  if (!origin) {
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    if (host) origin = `${proto}://${host}`;
  }

  if (!origin) {
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
