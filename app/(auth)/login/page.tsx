import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="login">
      <section className="login-card">
        <h1>Internal Task Management</h1>
        <p className="muted">Masuk menggunakan email dan password akun yang telah didaftarkan administrator.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={login} className="form section">
          <div className="field">
            <label>Email login</label>
            <input name="email" type="email" required autoComplete="email" placeholder="nama@gmail.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required autoComplete="current-password" />
          </div>
          <p className="muted small" style={{ textAlign: "right", margin: "-4px 0 2px" }}>
            <a href="/forgot-password">Lupa password?</a>
          </p>
          <button className="btn" type="submit">Masuk</button>
        </form>

        {/* Guest access intentionally removed. */}
        <div className="section-sm">
          <a className="btn secondary activation-trigger" href="/activate-account">Aktivasi Akun</a>
          <p className="muted small activation-help">Belum punya password? Kirim link aktivasi ke email yang sudah didaftarkan administrator.</p>
        </div>
      </section>
    </main>
  );
}
