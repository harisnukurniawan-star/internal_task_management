import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="login">
      <section className="login-card">
        <h1>Lupa Password</h1>
        <p className="muted">Masukkan username akun. Link reset password akan dikirim ke email recovery yang tersimpan di sistem.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestPasswordReset} className="form section">
          <div className="field">
            <label>Username</label>
            <input name="username" type="text" required autoComplete="username" placeholder="contoh: heri" />
          </div>
          <button className="btn" type="submit">Kirim Link Reset Password</button>
        </form>

        <div className="section-sm">
          <a className="btn secondary" href="/login">Kembali ke Login</a>
        </div>
      </section>
    </main>
  );
}
