import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../lib/layout";
import { loadSession } from "../../lib/session";
import { getHistory } from "../../lib/api";

export default function DonorDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const current = loadSession();
    if (!current || current.role !== "donor") {
      router.replace("/dashboard");
      return;
    }

    setSession(current);
    getHistory(current.address)
      .then((data) => setHistory(data.history || []))
      .catch(() => setHistory([]));
  }, [router]);

  const earnings = history.filter((item) => item.status >= 3).reduce((sum, item) => {
    return sum + Number(item.energyRequired || 0) * Number(item.pricePerUnitWei || 0);
  }, 0);

  return (
    <Shell title="Donor Dashboard" subtitle="Track earnings, review history, and open the live feed.">
      <section className="grid two">
        <article className="card role-amber">
          <h2>Earnings</h2>
          <p className="muted" style={{ marginTop: 8 }}>Settled value from completed donor sessions.</p>
          <p className="mono" style={{ marginTop: 8 }}>{earnings} wei</p>
        </article>

        <article className="card role-amber">
          <h2>Actions</h2>
          <div className="row" style={{ marginTop: 12 }}>
            <Link href="/donor/feed"><button className="amber">Open Live Feed</button></Link>
            <Link href="/history"><button>History</button></Link>
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Current profile</h3>
        <div className="kv" style={{ marginTop: 8 }}>
          <div className="item"><span>Name</span><span>{session?.name || "-"}</span></div>
          <div className="item"><span>Battery capacity</span><span>{session?.batteryCapacity || "-"} kWh</span></div>
          <div className="item"><span>Address</span><span className="mono">{session?.address || "-"}</span></div>
        </div>
      </section>
    </Shell>
  );
}
