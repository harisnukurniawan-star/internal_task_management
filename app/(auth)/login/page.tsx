import { login } from "./actions";
import { ActivationModal } from "./activation-modal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    activation_error?: string;
    activation_message?: string;
  }>;
}) {
  const { error, message, activation_error, activation_message } = await searchParams;

  return (
    <main className="login">
      <section className="login-card">
        <h1>Internal Task Management</h1>
        <p className="muted">Masuk menggunakan akun yang telah didaftarkan oleh administrator.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={login} className="form section">
          <div className="field">
            <label>Email login</label>
            <input name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn" type="submit">Masuk</button>
        </form>

        <div className="login-divider"><span>atau</span></div>
        <a className="btn secondary activation-trigger" href="#activation">Aktivasi akun / Buat password</a>
        <p className="muted small activation-help">Klik tombol di atas untuk membuka form khusus pengiriman link aktivasi. Email aktivasi diisi terpisah dari email login.</p>
      </section>

      <ActivationModal error={activation_error} message={activation_message} />
    </main>
  );
}
