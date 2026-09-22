import { requestActivation } from "./actions";

export function ActivationModal({ error, message }: { error?: string; message?: string }) {
  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Masukkan username yang diberikan administrator, lalu buat password.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestActivation} className="form section-sm">
          <div className="field">
            <label>Username</label>
            <input
              name="activation_username"
              type="text"
              required
              autoComplete="username"
              inputMode="text"
              placeholder="contoh: heri"
              pattern="[a-zA-Z0-9._-]{3,40}"
              title="Gunakan username yang diberikan administrator"
            />
            <small className="muted">Email recovery dan role diambil otomatis dari data user di sistem.</small>
          </div>

          <div className="field">
            <label>Password</label>
            <input name="activation_password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Konfirmasi password</label>
            <input name="activation_password_confirmation" type="password" minLength={8} required autoComplete="new-password" />
          </div>

          <button className="btn" type="submit">Aktifkan Akun & Masuk</button>
          <a className="btn secondary activation-cancel" href="#">Batal</a>
        </form>
      </section>
    </div>
  );
}
