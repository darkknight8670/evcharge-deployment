import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../lib/layout";
import { getSummary } from "../lib/api";
import { loadSession, saveSession } from "../lib/session";

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setSession(loadSession());
    getSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  function chooseRole(role) {
    if (!session) {
      router.push("/login");
      return;
    }

    const next = { ...session, role };
    saveSession(next);
    setSession(next);

    if (role === "receiver") {
      router.push("/receiver/dashboard");
    } else {
      router.push("/donor/dashboard");
    }
  }

  const soc = session ? Math.min(98, Number(session.batteryCapacity || 0) / 1.5).toFixed(0) : "0";
  const tokenBalance = summary ? Number(summary.requestCount || 0) * 3 + 120 : 120;

  return (
    <Shell title="Role Picker" subtitle="Choose receiver (green) or donor (amber). No mixed controls here.">
      <section className="grid two">
        <article className="card role-green">
          <h2>Receiver mode</h2>
          <p className="muted" style={{ marginTop: 8 }}>Create a new request, broadcast, wait, and track charging completion.</p>
          <button className="primary" style={{ marginTop: 14 }} onClick={() => chooseRole("receiver")}>Enter Receiver Flow</button>
        </article>

        <article className="card role-amber">
          <h2>Donor mode</h2>
          <p className="muted" style={{ marginTop: 8 }}>Scan live requests, accept eligible jobs, and track earnings and settlement.</p>
          <button className="amber" style={{ marginTop: 14 }} onClick={() => chooseRole("donor")}>Enter Donor Flow</button>
        </article>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Context</h3>
        <div className="kv" style={{ marginTop: 8 }}>
          <div className="item"><span>Wallet</span><span className="mono">{session?.address || "not logged in"}</span></div>
          <div className="item"><span>SOC</span><span>{soc}%</span></div>
          <div className="item"><span>Token balance</span><span>{tokenBalance} TKN</span></div>
          <div className="item"><span>Battery capacity</span><span>{session?.batteryCapacity || "-"} kWh</span></div>
        </div>
      </section>
    </Shell>
  );
}
