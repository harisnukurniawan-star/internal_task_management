import { ActivationForm } from "./activation-form";

export default function ActivateAccountPage() {
  return (
    <main className="login">
      <section className="login-card">
        <h1>Aktivasi Akun</h1>
        <p className="muted">
          Masukkan email yang sudah didaftarkan administrator. Kami akan mengirim link aktivasi ke email tersebut.
        </p>
        <p className="muted small">
          Setelah link dibuka, Anda akan diarahkan ke halaman pembuatan password. Polanya sama seperti reset password.
        </p>

        <ActivationForm />

        <div className="section-sm">
          <a className="btn secondary" href="/login">Kembali ke Login</a>
        </div>
      </section>
    </main>
  );
}
