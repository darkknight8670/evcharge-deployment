import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "../../lib/layout";
import { getDonorFeed } from "../../lib/api";

export default function DonorFeedPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadFeed() {
    try {
      const data = await getDonorFeed();
      setItems(data.items || []);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadFeed();

    const timer = setInterval(() => {
      loadFeed();
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Shell title="Donor Live Feed" subtitle="Open broadcasts with distance, need, rate, and matched lock state.">
      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <p className="muted">{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : "Loading feed..."}</p>
        <button onClick={loadFeed}>Refresh now</button>
      </div>

      {error ? <p style={{ color: "#ff9a9a" }}>{error}</p> : null}
      <section className="grid" style={{ marginTop: 10 }}>
        {!items.length ? <article className="card"><p className="muted">No open broadcasts yet. Keep this page open, it auto-refreshes every 4 seconds.</p></article> : null}
        {items.map((item) => {
          const matched = !!item.matched;
          return (
            <article key={item.id} className={`card feed-item ${matched ? "matched" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>Request #{item.id}</h3>
                <span className={`pill ${matched ? "badge-matched" : "badge-open"}`}>
                  {matched ? "already matched" : "open"}
                </span>
              </div>

              <div className="kv" style={{ marginTop: 8 }}>
                <div className="item"><span>Distance</span><span>{item.distanceKm} km</span></div>
                <div className="item"><span>kWh needed</span><span>{item.energyRequired}</span></div>
                <div className="item"><span>Token rate</span><span className="mono">{item.pricePerUnitWei}</span></div>
                <div className="item"><span>Receiver</span><span className="mono">{item.receiver}</span></div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                {matched ? (
                  <button disabled>Already matched</button>
                ) : (
                  <Link href={`/donor/confirm/${item.id}`}><button className="amber">Review & accept</button></Link>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </Shell>
  );
}
