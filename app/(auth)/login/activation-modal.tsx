import { requestActivation } from "./actions";

const USERS = [
  { value: "system_admin", label: "Admin · hcconnectpln@gmail.com" },
  { value: "endang_mirah_ayu", label: "Endang Mirah Ayu · Employee" },
  { value: "citra_aries", label: "Citra Aries · Employee" },
  { value: "heri_syamsudin", label: "Heri Syamsudin · Employee · hery.syam@gmail.com" },
];

export function ActivationModal({ error, message }: { error?: string; message?: string }) {
  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Buat akun dan password langsung tanpa link email.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        <p className="notice warning">
          <strong>First Gmail binding:</strong> Admin dikunci ke hcconnectpln@gmail.com, Heri Syamsudin ke hery.syam@gmail.com. Endang dan Citra akan dikunci ke Gmail pertama yang berhasil diaktifkan. Harisnu Kurniawan sudah memiliki akun Supervisor aktif.
        </p>

        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestActivation} className="form section-sm">
          <div className="field">
            <label>Nama user</label>
            <select name="activation_user" required defaultValue="">
              <option value="" disabled>Pilih user</option>
              {USERS.map((user) => (
                <option key={user.value} value={user.value}>{user.label}</option>
              ))}
              <option value="" disabled>Harisnu Kurniawan · Supervisor · sudah aktif</option>
            </select>
          </div>
          <div className="field">
            <label>Gmail untuk login</label>
            <input
              name="activation_email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="nama@gmail.com"
              pattern="[A-Za-z0-9._%+\-]+@gmail\.com"
              title="Gunakan alamat Gmail dengan akhiran @gmail.com"
            />
            <small className="muted">Satu Gmail hanya dapat terikat ke satu user.</small>
          </div>
          <div className="field">
            <label>Kode aktivasi</label>
            <input name="activation_code" type="password" required autoComplete="one-time-code" />
            <small className="muted">Gunakan kode aktivasi sekali pakai yang diberikan Admin.</small>
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
