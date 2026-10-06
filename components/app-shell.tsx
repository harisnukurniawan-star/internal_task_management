import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} notifikasi`}
      style={{
        minWidth: 18,
        height: 18,
        padding: count > 9 ? "0 5px" : 0,
        borderRadius: 999,
        background: "#f97316",
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 800,
        flex: "0 0 auto",
        boxShadow: "0 0 0 2px #2a3587",
      }}
    >
      {label}
    </span>
  );
}

export function AppShell({
  children,
  role,
  name,
  validationCount = 0,
  assignmentCount = 0,
}: {
  children: React.ReactNode;
  role: string;
  name: string;
  validationCount?: number;
  assignmentCount?: number;
}) {
  const supervisor = role === "supervisor" || role === "admin";
  const admin = role === "admin";
  const roleLabel = admin ? "Admin" : supervisor ? "Supervisor" : "Employee";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Internal Task Management<small>{name} · {roleLabel}</small></div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          {supervisor ? (
            <>
              <Link href="/tasks">Team Tasks</Link>
              {admin ? <Link href="/employee-entry">Employee Entry Review</Link> : null}
              <Link href="/reviews" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>Validation & Evaluation</span>
                <NotificationBadge count={validationCount} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/my-week">My Week</Link>
              <Link href="/my-tasks" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>My Tasks</span>
                <NotificationBadge count={assignmentCount} />
              </Link>
            </>
          )}
          <Link href="/leaderboard">Leaderboard</Link>
          <Link
              href="/manage-goals"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                whiteSpace: "nowrap",
                fontSize: 13,
              }}
            >
              <span>Manage Goals</span>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 2,
                  padding: "2px 4px",
                  borderRadius: 4,
                  background: "#ffffff",
                  flex: "0 0 auto",
                  boxShadow: "0 0 0 1px rgba(255,255,255,.12)",
                }}
              >
                <img
                  src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NjAgNDc1Ij4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDBCMUVCIi8+PHN0b3Agb2Zmc2V0PSIuMiIgc3RvcC1jb2xvcj0iIzAwOUFEOSIvPjxzdG9wIG9mZnNldD0iLjUiIHN0b3AtY29sb3I9IiMwMDg4Q0IiLz48c3RvcCBvZmZzZXQ9Ii44IiBzdG9wLWNvbG9yPSIjMDA2REI3Ii8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDA2OUI0Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+CjxwYXRoIGQ9Ik0wIDBIOTYwTDQ4NyA0NzVIMFoiIGZpbGw9InVybCgjZykiLz4KPHBhdGggZD0iTTE0LDM1OUwzNCwzNjlMNTksMzc4TDc5LDM4M0w5OSwzODVMMTAwLDM4NkwxMTgsMzg2TDExOSwzODdMMTM5LDM4NkwxNjUsMzgxTDE4OSwzNzFMMjAzLDM2MkwyMDgsMzU3TDIxMCwzNTlMMjAxLDM4MkwyODUsMzgyTDMwMCwzMzhMMzI0LDM0NEwzNDIsMzQ1TDM0MywzNDZMMzcxLDM0NUwzNzIsMzQ0TDM4OCwzNDJMNDAwLDMzOEw0MDIsMzQxTDQwNCwzNTBMNDE1LDM4Mkw1NTMsMzgyTDU1MywyOTJMNTU0LDI5MUw1OTUsMjkxTDU5NiwyOTBMNjA3LDI5MEw2MDgsMjg5TDYyNCwyODdMNjQ4LDI3OUw2NjksMjY2TDY4MSwyNTRMNjg4LDI0NEw2OTQsMjMyTDY5OCwyMjBMNzAwLDIxMEw3MDAsMjAzTDcwMSwyMDJMNzAxLDE3OUw3MDAsMTc4TDcwMCwxNzBMNjk3LDE1Nkw2ODgsMTM1TDY3NSwxMTlMNjYwLDEwOEw2NDgsMTAyTDYzNCw5N0w2MjIsOTRMNjA0LDkyTDYwMyw5MUw1OTMsOTFMNTkyLDkwTDQ3Niw5MEw0NzYsMzEzTDQ3NSwzMTRMNDczLDMxMkw0NjgsMjk5TDQ2NiwyOTFMNDUwLDI1MEw0NDgsMjQyTDQ0NiwyMzlMNDQ0LDIzMUw0MzksMjIwTDQzNywyMTJMNDMyLDIwMUw0MzAsMTkzTDQyOCwxOTBMNDI2LDE4Mkw0MjEsMTcxTDQxOSwxNjNMNDE0LDE1MkwzOTIsOTBMMzExLDkwTDMxMCw5MUwyNzksMTc2TDI3NSwxODRMMjcwLDIwMEwyNjYsMjA4TDI0NCwyNjlMMjQwLDI3N0wyMzgsMjc0TDIzOCwyNzBMMjM1LDI2MUwyMzEsMjUzTDIyMywyNDJMMjExLDIzMUwxOTksMjIzTDE3MSwyMTBMMTI4LDE5NkwxMDcsMTg2TDEwMCwxODFMOTIsMTcxTDkyLDE2M0w5OCwxNTVMMTA5LDE0OUwxMTgsMTQ3TDE0NiwxNDdMMTQ3LDE0OEwxNjAsMTQ5TDE4NCwxNTZMMjA0LDE2NUwyMzYsMTA5TDIwMCw5NUwxODUsOTFMMTY0LDg3TDE1OCw4N0wxNTcsODZMMTE0LDg1TDExMyw4NkwxMDUsODZMODYsOTBMNjcsOTdMNDgsMTA4TDMxLDEyNEwyNiwxMzFMMTksMTQ1TDE0LDE2NEwxNCwxODdMMTcsMjAxTDIxLDIxMUwyOCwyMjJMNDMsMjM3TDU4LDI0N0w3NiwyNTZMOTEsMjYyTDEyNywyNzNMMTQ1LDI4MUwxNTIsMjg2TDE1NywyOTNMMTU4LDI5NkwxNTcsMzA2TDE1MCwzMTZMMTM5LDMyMkwxMzAsMzI0TDEwMSwzMjRMMTAwLDMyM0w4NCwzMjFMNjksMzE2TDUyLDMwOEw0MywzMDJaTTM1MSwxODBMMzUzLDE4M0wzNTMsMTg2TDM2MiwyMTJMMzYyLDIxNUwzNzEsMjQxTDM3MSwyNDRMMzc1LDI1NEwzODEsMjc2TDM3OCwyNzhMMzY2LDI4MUwzNDIsMjgyTDMyMywyNzhMMzIwLDI3NkwzMjAsMjc0TDM0NiwxOTRMMzQ2LDE5MUwzNDksMTgyWk01NTMsMTUxTDU1NCwxNTBMNTg3LDE1MEw1OTcsMTUyTDYxMSwxNThMNjIyLDE3MEw2MjUsMTc5TDYyNSwxODZMNjI2LDE4N0w2MjQsMjAyTDYxNywyMTRMNjA4LDIyMUw1OTUsMjI2TDU4MSwyMjdMNTgwLDIyOEw1NTQsMjI4TDU1MywyMjdaIiBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KPC9zdmc+"
                  alt=""
                  width="28"
                  height="14"
                  style={{
                    display: "block",
                    width: 28,
                    height: 14,
                    objectFit: "contain",
                    flex: "0 0 auto",
                  }}
                />
              </span>
            </Link>
        </nav>
        <form action={logout} style={{ marginTop: "auto" }}><button className="btn secondary" type="submit">Keluar</button></form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
