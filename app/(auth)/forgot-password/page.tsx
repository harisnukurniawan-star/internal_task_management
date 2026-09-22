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
        <p className="muted">Masukkan email akun Internal Task Management. Kami akan mengirim link untuk membuat password baru.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestPasswordReset} className="form section">
          <div className="field">
            <label>Email akun</label>
            <input name="email" type="email" required autoComplete="email" />
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
