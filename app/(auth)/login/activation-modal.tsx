import { requestActivation } from "./actions";

const USERS = [
  { value: "system_admin", label: "Admin", detail: "hcconnectpln@gmail.com" },
  { value: "endang_mirah_ayu", label: "Endang Mirah Ayu", detail: "Employee" },
  { value: "citra_aries", label: "Citra Aries", detail: "Employee" },
  { value: "heri_syamsudin", label: "Heri Syamsudin", detail: "Employee · hery.syam@gmail.com" },
];

export function ActivationModal({ error, message }: { error?: string; message?: string }) {
  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Pilih user, isi Gmail, lalu buat password. Kode keamanan aktivasi dibuat otomatis oleh sistem.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        <p className="notice warning">
          <strong>First Gmail binding:</strong> Admin dikunci ke hcconnectpln@gmail.com, Heri Syamsudin ke hery.syam@gmail.com. Endang dan Citra akan dikunci ke Gmail pertama yang berhasil diaktifkan. Harisnu Kurniawan sudah memiliki akun Supervisor aktif.
        </p>

        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}

        <form action={requestActivation} className="form section-sm">
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>Nama user</legend>
            <div style={{ display: "grid", gap: 8 }}>
              {USERS.map((user) => (
                <label key={user.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #d7e0ea", borderRadius: 10, cursor: "pointer" }}>
                  <input type="radio" name="activation_user" value={user.value} required />
                  <span><strong>{user.label}</strong><br /><small className="muted">{user.detail}</small></span>
                </label>
              ))}
            </div>
            <small className="muted">Harisnu Kurniawan · Supervisor · sudah aktif.</small>
          </fieldset>

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
