import { setPassword } from "./actions";
import { RecoverySessionBridge } from "./recovery-session-bridge";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="login">
      <section className="login-card">
        <RecoverySessionBridge />
        {error ? <p className="notice error">{error}</p> : null}
        <form action={setPassword} className="form section">
          <div className="field">
            <label>Password baru</label>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Konfirmasi password baru</label>
            <input
              name="password_confirmation"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <button className="btn" type="submit">Set Password</button>
        </form>
      </section>
    </main>
  );
}
