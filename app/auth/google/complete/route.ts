import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
  const userId = claims?.sub;
  const email = claims?.email?.trim().toLowerCase();

  if (claimsError || !userId || !email) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Sesi Google tidak valid." }, { status: 401 });
  }

  const [{ data: allowed }, { data: profile }] = await Promise.all([
    supabase
      .from("access_allowlist")
      .select("email,active")
      .eq("email", email)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id,full_name,role,active")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (!allowed?.active || !profile?.active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Akun Google ini belum didaftarkan atau aksesnya sedang nonaktif." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
