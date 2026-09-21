import { GoogleSignInButton } from "@/components/google-sign-in-button";

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
        <p className="muted">
          Masuk menggunakan akun Google yang sudah didaftarkan oleh administrator.
        </p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <GoogleSignInButton />

        <div className="login-divider"><span>atau</span></div>
        <a className="btn secondary activation-trigger" href="/guest">Masuk sebagai Guest</a>
        <p className="muted small activation-help">
          Buka preview aplikasi dalam mode read-only tanpa login dan tanpa akses data privat.
        </p>

        <p className="muted small" style={{ textAlign: "center", marginTop: 18 }}>
          Akses user dan role tetap dikelola oleh administrator aplikasi.
        </p>
      </section>
    </main>
  );
}
