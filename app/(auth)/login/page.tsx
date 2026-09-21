import { login, requestActivation } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  return (
    <main className="login">
      <section className="login-card">
        <h1>Internal Task Management</h1>
        <p className="muted">Masuk menggunakan akun yang telah didaftarkan oleh administrator.</p>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        {message ? <p style={{ color: "#067647" }}>{message}</p> : null}
        <form action={login} className="form section">
          <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="email" /></div>
          <div className="field"><label>Password</label><input name="password" type="password" required autoComplete="current-password" /></div>
          <button className="btn" type="submit">Masuk</button>
          <button className="btn secondary" type="submit" formAction={requestActivation} formNoValidate>Aktivasi akun / Buat password</button>
          <p className="muted small">Untuk aktivasi awal atau lupa password, isi email lalu klik tombol aktivasi. Link pembuatan password akan dikirim ke email terdaftar.</p>
        </form>
      </section>
    </main>
  );
}
