import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="login">
      <section className="login-card">
        <h1>Lupa Password</h1>
        <p className="muted">Masukkan email akun Internal Task Management yang sudah pernah diaktifkan. Kami akan mengirim link terbaru untuk membuat password baru.</p>
        <p className="muted small">Belum pernah aktivasi? Gunakan <a href="/login#activation">Aktivasi akun / Buat password</a> terlebih dahulu. Reset password hanya berlaku untuk akun Auth yang sudah terbentuk.</p>

        <ForgotPasswordForm />

        <div className="section-sm">
          <a className="btn secondary" href="/login">Kembali ke Login</a>
        </div>
      </section>
    </main>
  );
}
