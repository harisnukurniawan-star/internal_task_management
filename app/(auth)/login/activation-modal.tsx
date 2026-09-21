import { requestActivation } from "./actions";

export function ActivationModal({ error, message }: { error?: string; message?: string }) {
  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Masukkan email akun yang ingin menerima link aktivasi / pembuatan password.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestActivation} className="form section-sm">
          <div className="field">
            <label>Email tujuan aktivasi</label>
            <input
              name="activation_email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
            />
          </div>
          <button className="btn" type="submit">Kirim Link Aktivasi</button>
          <a className="btn secondary activation-cancel" href="#">Batal</a>
        </form>
      </section>
    </div>
  );
}
