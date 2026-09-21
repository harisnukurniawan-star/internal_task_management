import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent("Buka halaman ini melalui link aktivasi yang dikirim ke email.")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.active) {
    redirect(`/login?error=${encodeURIComponent("Akun belum diaktifkan oleh administrator.")}`);
  }

  const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "";

  return (
    <main className="login">
      <section className="login-card">
        <h1>Aktivasi Akun</h1>
        <p className="muted">{profile.full_name}{email ? ` · ${email}` : ""}</p>
        <p>Buat password untuk menyelesaikan aktivasi akun.</p>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        <form action={setPassword} className="form section">
          <div className="field"><label>Password baru</label><input name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
          <div className="field"><label>Konfirmasi password</label><input name="password_confirmation" type="password" minLength={8} required autoComplete="new-password" /></div>
          <button className="btn" type="submit">Simpan Password & Masuk</button>
        </form>
      </section>
    </main>
  );
}
