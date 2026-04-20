import { useEffect, useState } from "react";
import { Shell } from "../lib/layout";
import { getHistory } from "../lib/api";
import { loadSession } from "../lib/session";

export default function HistoryPage() {
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const current = loadSession();
    setSession(current);
    if (!current?.address) {
      setHistory([]);
      return;
    }

    const wallet = String(current.address).toLowerCase();

    getHistory(current.address)
      .then((data) => {
        const userOnly = (data.history || []).filter((item) => {
          const receiver = String(item?.receiver || "").toLowerCase();
          const donor = String(item?.donor || "").toLowerCase();
          return receiver === wallet || donor === wallet;
        });
        setHistory(userOnly);
      })
      .catch(() => setHistory([]));
  }, []);

  return (
    <Shell title="History" subtitle="Unified receiver and donor history from on-chain requests.">
      <section className="card">
        {!session?.address ? (
          <p className="muted">Login first to view wallet history.</p>
        ) : (
          <div className="grid" style={{ marginTop: 8 }}>
            {history.map((item) => (
              <article className="card" key={item.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>Request #{item.id}</h3>
                  <span className="pill">{item.statusLabel}</span>
                </div>
                <div className="kv" style={{ marginTop: 8 }}>
                  <div className="item"><span>Receiver</span><span className="mono">{item.receiver}</span></div>
                  <div className="item"><span>Donor</span><span className="mono">{item.donor}</span></div>
                  <div className="item"><span>Energy</span><span>{item.energyRequired}</span></div>
                  <div className="item"><span>Rate</span><span>{item.pricePerUnitWei}</span></div>
                </div>
              </article>
            ))}
            {!history.length ? <p className="muted">No records yet.</p> : null}
          </div>
        )}
      </section>
    </Shell>
  );
}
