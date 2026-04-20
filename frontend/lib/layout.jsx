import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSession } from "./session";

const ADMIN_WALLET = "0x389f141512610d5Db0A55cA8924405Dc842AE0F1".toLowerCase();

export function Shell({ title, subtitle, children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const session = loadSession();
    setIsLoggedIn(Boolean(session?.address));
    setIsAdmin(String(session?.address || "").toLowerCase() === ADMIN_WALLET);
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="muted" style={{ marginTop: 6 }}>{subtitle}</p> : null}
          </div>
          <nav className="row">
            <Link className="pill" href="/">Home</Link>
            {isLoggedIn ? (
              <>
                <Link className="pill" href="/dashboard">Dashboard</Link>
                <Link className="pill" href="/history">History</Link>
                <Link className="pill" href="/profile">Profile</Link>
                {isAdmin ? <Link className="pill" href="/admin">Admin</Link> : null}
              </>
            ) : (
              <Link className="pill" href="/login">Login</Link>
            )}
          </nav>
        </div>
      </section>
      <div style={{ marginTop: 14 }}>{children}</div>
    </main>
  );
}
