import { login } from "./actions";
import { ActivationModal } from "./activation-modal";
import { ActivationToast } from "./activation-toast";

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
          <p className="muted small" style={{ textAlign: "right", margin: "-4px 0 2px" }}>
            <a href="/forgot-password">Lupa password?</a>
          </p>
          <button className="btn" type="submit">Masuk</button>
        </form>

        <div className="login-divider"><span>atau</span></div>
        <a className="btn secondary activation-trigger" href="/guest">Masuk sebagai Guest</a>
        <p className="muted small activation-help">Buka preview aplikasi dalam mode read-only tanpa login dan tanpa akses data privat.</p>

        <div className="section-sm">
          <a className="btn secondary activation-trigger" href="#activation">Aktivasi akun / Buat password</a>
          <p className="muted small activation-help">Akun baru diaktifkan langsung dengan Gmail dan password. Grant keamanan dibuat otomatis oleh server.</p>
        </div>
      </section>

      <ActivationModal error={activation_error} message={activation_message} />
      <ActivationToast
        type={activation_error ? "error" : activation_message ? "success" : undefined}
        message={activation_error || activation_message}
      />
    </main>
  );
}
