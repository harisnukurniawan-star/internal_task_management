import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";

export function AppShell({ children, role, name }: { children: React.ReactNode; role: string; name: string }) {
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
              <Link href="/reviews">Validation & Evaluation</Link>
            </>
          ) : (
            <>
              <Link href="/my-week">My Week</Link>
              <Link href="/my-tasks">My Tasks</Link>
            </>
          )}
          <Link href="/leaderboard">Leaderboard</Link>
          {supervisor ? (
            <Link
              href="/manage-goals"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                whiteSpace: "nowrap",
                fontSize: 13,
              }}
            >
              <span>Manage Goals</span>
              <img
                src="data:image/webp;base64,UklGRhgHAABXRUJQVlA4WAoAAAAQAAAASwAAJQAAQUxQSH8AAAABCQNp2zDi3/X2W4jo/wRkMki3fOA2kmSnmt1HZIRGePhkI85C75dWxAQobNsGadUx/FGRwrLoDGIkgAly2KCTA4NYkADJ6QbBUFJQYECM2QofTE1U9xOqfLxr8vliKfJ+YoHJB3xUor7+DzSDWYwWTSNIMSsb3VMpN2nSwx0AAFZQOCByBgAAECIAnQEqTAAmAD4ZCINBIQZmq4AEAGEtgBdnKC/APwA6MaHXRfwb/Fr5WaV/FPtt+43+izJTl/+YfcB7z/7l+M3yA/Hn929RH+1fafwhf5J/a/9J/cPeV9AHoAfzz+x+hB7AHoAfsl6qv+V/Zb4H/2e/6H+h+A/9Z7uY+zfjN1nXhn1p/afLzPZvyx5AdpX+nfkVwr3Jv5R/bvzA5iu8t/Pf8lxvtAD8bf7b+0f1D/R+9N/g/qj+yvtx+h/+J7gv8X/mv+Q/uX7x/53wSehb+rhgafA/R1Mun7O2c/LGY4O1gpe1cPAHKEqipOrHX20Py/d/Bi0Xwt4I/qAqA5iHCztC5VM0CH1lQHNRoR+veuqi+S8GgW0wdNgA/U5PxVTh5/tBI0TezIs/Obfzq3/65vo99cEoUBUpwa7gImP/d3NiUfQcz/sCN2dWSy3PfX9a7wk1bt67gn/9OWUZX0HvkuRURNbfQ+KlHZWXmyeE86JC76Um/iRQj/IbhOf/SgkMz3GfdByO4d+1Kgtt1hTRjVaKagIh0uAQ5zrf15wVGf/9LkPSoE4HytTFE/HVYDuCCQPWz26IF1McferH17/LcH96ZlEJykU0+zbUY8CywG/qhKijcCAPOfGx9k4jDhEqtTqu3FCjBwhwpYR4VepiaFIZQAlAFW7QS8S/y5srggoMWEchW0DoDz7yEtNwhknDc3i5jdqq3wTfJTW+vxUNvCV+KjShwv3pSAlgEX7r8BJbUUdX3lmMe3thorZ7al+yVLl8z2Fh/KNC0M4wzG+hROapzH/iRkaLSRNLTz6sIhaqp1uQV6NMjylwoYz8oWWhZSPVShTINOeI6bQ5J0wJF2IY35YLVYYqrhGxnKpUE8CPe0yHXWOTuPDR+x/erjpfOsv7CaPRsM/3sva5R+3b/4FjQXBwVZlM4XlN1cnYCDgO3XZJzIhIulnwNdcOYMjYKNpM18TsmbuGRW4krk3VK9w+geP1eLOBrHOx1di+eAup94pknONOMh+e2PyH3aB/5IN9cL4r8YOD7Ejq8RjWjyCKkawAAbcIU8uLGGEh7YnqF3aQLorK1Mk5FBN1LduOUJG9ynDxC7zfecUvGCXz2Ht4I2Wk+6ePjRKh2+SKkq4t8gSTsrOdZQVLhaeGvg+vdxOIKIKA+AIZ7m0bX5Jy4S3mSLX/+ajIFUqAD1sRhQMT2pfI65v3GqXxk9Cqe8QSoxIYgsSaItEueVkmfyc7VXLSPNx9MuwxyWtgZVgBht+yKDv8KUgr1nCTHmT/nhpvk/kPM5w12r+9SitfIooPEMAZaPMBK+zVmpsddYIsW9X1GanD24SWMvMPSOev+tH//R3YF09eMR3wV9SGIWty/P8km20m2qM11HWk70EkJ//7HX94jI0z3nMshSTT3j40Vlnl+5Xcb4JAzy498tRjPlwyvEy3brbn6kYzJv+xIDpbrokTq06soR6B476PpVPfCLoeSZlJKwecRwZxr2sfOV3jB5kcKqo/6VHfcV8ddlXTHgtv5RGYafFrNPV9HCzsgVy0GCcKwiaYWLylJ5o+nhIr/gSG1MOI2P/9Wb+qEC9NO0fEaF9Auc1uL9AGxyaWvqeFDI+P/uZv7ZSx9iLYIsIMu1aeyJbb9nM5Kh/1BvX6oxA/Lfn8IwFnAN3BpGxOF7hkSmewp+NFTr56L8/Say7gr83qF0BMQ3/+mN5hMP9uZiZ0PdhuusPGRqMsnA+JMKxZ7KhdFpH3VtAgsN3SPeDKHcWykc//gyWFx7y5XZ9F3OKK96rpnueRKDFLTVWLs+6JaKDClEV2kCzv5wFmGTvt3NKbgMPOtxLKSfhabUD0yj+KhzB4ImiviJ8bz4FMJAlFkU1ohj+Cu6/Gt8GHNPmkf+v8dMsmPaazgOZotzkw7pmOPuyofsZJFefW4et8OIIkv/yrgUu/e6MtN2jSUbvVGE0k+NDtsvGbZ4LmRoeOX2LSdldDHLu/vhtZBYrT2C3aYXfjumdYSC1M41pV6H/b8gaI8PmI7+7ofFPtORKE4hBPzFpECVqWBQaMiP/g4xJfnfcAXJTEtX7lF+UQwcm+uN8iM/yTnCbMTBQ6O9DbALIQiPCXsC/CdltwZXzbXeZbcGmWdOEGxLVKa944sI+DvKVaC/dGRohZ635H5lt3JDLkCZoCZNYuqVQfH0DeAn//aDJnFUH/c/eh4AAAAAAA"
                alt="SAP"
                width="30"
                height="15"
                style={{ display: "block", width: 30, height: 15, objectFit: "contain", flex: "0 0 auto" }}
              />
            </Link>
          ) : null}
        </nav>
        <form action={logout} style={{ marginTop: "auto" }}><button className="btn secondary" type="submit">Keluar</button></form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
