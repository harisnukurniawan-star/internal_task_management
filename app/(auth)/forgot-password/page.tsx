import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="login">
      <section className="login-card">
        <h1>Lupa Password</h1>
        <p className="muted">Masukkan email akun Internal Task Management. Kami akan mengirim link terbaru untuk membuat password baru.</p>

        <ForgotPasswordForm />

        <div className="section-sm">
          <a className="btn secondary" href="/login">Kembali ke Login</a>
        </div>
      </section>
    </main>
  );
}
