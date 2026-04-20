import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../../lib/layout";
import { getSession as getSessionApi, startSessionCharging } from "../../../lib/api";

export default function DonorSessionPage() {
  const router = useRouter();
  const id = router.query.id;
  const [soc, setSoc] = useState(0);
  const [payload, setPayload] = useState(null);
  const [log, setLog] = useState(["donor monitor ready", "watching escrow state"]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const data = await getSessionApi(id);
        setPayload(data);
        setSoc(Number(data?.progress?.soc || 0));
        setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${data.request.statusLabel}`, ...prev].slice(0, 25));

        const effectiveStatus = Number(data.request.effectiveStatus ?? data.request.status ?? 0);
        if (effectiveStatus >= 3) {
          router.push(`/donor/complete?id=${id}`);
        }
      } catch {
        setLog((prev) => [`[${new Date().toLocaleTimeString()}] awaiting updates`, ...prev].slice(0, 25));
      }
    }, 3500);

    return () => {
      clearInterval(poll);
    };
  }, [id, router]);

  async function handleStartCharging() {
    if (!id) {
      return;
    }

    try {
      setStarting(true);
      setError("");
      await startSessionCharging(id);
      setLog((prev) => [`[${new Date().toLocaleTimeString()}] charging simulation started by backend`, ...prev].slice(0, 25));
    } catch (err) {
      setError(String(err?.message || "Unable to start charging"));
    } finally {
      setStarting(false);
    }
  }

  const steps = useMemo(() => payload?.escrowSteps || [], [payload]);
  const canStart = Number(payload?.request?.effectiveStatus ?? payload?.request?.status ?? 0) < 2;

  return (
    <Shell title={`Donor Live Session #${id || ""}`} subtitle="Start charging and let backend simulate delivery + payout.">
      <section className="grid two">
        <article className="card">
          <h3>Vehicle SOC</h3>
          <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${soc}%`, background: "linear-gradient(90deg, #f6c168, #f0a037)" }} /></div>
          <p className="muted" style={{ marginTop: 8 }}>{soc.toFixed(0)}%</p>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="amber" onClick={handleStartCharging} disabled={!canStart || starting}>
              {canStart ? (starting ? "Starting..." : "Start charging") : "Charging started"}
            </button>
          </div>
          {error ? <p style={{ color: "#ff9393", marginTop: 8 }}>{error}</p> : null}

          <h3 style={{ marginTop: 16 }}>Escrow watch</h3>
          <div className="kv" style={{ marginTop: 8 }}>
            {steps.map((step) => (
              <div className="item" key={step.step}>
                <span>{step.step}</span>
                <span>{step.done ? "done" : "pending"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Live log</h3>
          <div className="log" style={{ marginTop: 10 }}>
            {log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        </article>
      </section>
    </Shell>
  );
}
