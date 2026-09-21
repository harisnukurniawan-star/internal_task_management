import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resetPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/login?error=${encodeURIComponent("Buka halaman reset password melalui link yang dikirim ke email.")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Akun belum aktif. Hubungi administrator atau gunakan menu Aktivasi Akun.")}`);
  }

  return (
    <main className="login">
      <section className="login-card">
        <h1>Reset Password</h1>
        {error ? <p className="notice error">{error}</p> : null}

        <form action={resetPassword} className="form section">
          <div className="field">
            <label>Password baru</label>
            <input name="password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Konfirmasi password baru</label>
            <input name="password_confirmation" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <button className="btn" type="submit">Set Password</button>
        </form>
      </section>
    </main>
  );
}
