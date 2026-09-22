import { requestActivation } from "./actions";

const USERS = [
  { value: "harisnu_kurniawan", label: "Harisnu Kurniawan · Admin / Supervisor" },
  { value: "endang_mirah_ayu", label: "Endang Mirah Ayu · Employee" },
  { value: "citra_aries", label: "Citra Aries · Employee" },
  { value: "heri_syamsudin", label: "Heri Syamsudin · Employee" },
];

export function ActivationModal({ error, message }: { error?: string; message?: string }) {
  return (
    <div id="activation" className="activation-modal" role="dialog" aria-modal="true" aria-labelledby="activation-title">
      <a className="activation-backdrop" href="#" aria-label="Tutup popup aktivasi" />
      <section className="activation-card">
        <div className="activation-head">
          <div>
            <h2 id="activation-title">Aktivasi akun</h2>
            <p className="muted small">Pilih nama user, lalu daftarkan Gmail yang akan dipakai untuk login.</p>
          </div>
          <a className="activation-close" href="#" aria-label="Tutup">×</a>
        </div>

        <p className="notice warning">
          <strong>First Gmail binding:</strong> Gmail pertama yang berhasil didaftarkan akan dikunci ke user tersebut. Aktivasi berikutnya harus memakai Gmail yang sama.
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
            <small className="muted">Hanya alamat @gmail.com. Satu Gmail hanya dapat terikat ke satu user.</small>
          </div>
          <button className="btn" type="submit">Daftarkan Gmail & Kirim Link</button>
          <a className="btn secondary activation-cancel" href="#">Batal</a>
        </form>
      </section>
    </div>
  );
}
