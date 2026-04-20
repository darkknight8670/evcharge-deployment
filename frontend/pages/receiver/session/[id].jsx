import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../../lib/layout";
import { getSession as getSessionApi } from "../../../lib/api";

export default function ReceiverSessionPage() {
  const router = useRouter();
  const id = router.query.id;
  const [soc, setSoc] = useState(0);
  const [payload, setPayload] = useState(null);
  const [log, setLog] = useState([
    "session init...",
    "escrow monitor attached",
  ]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const data = await getSessionApi(id);
        setPayload(data);
        setSoc(Number(data?.progress?.soc || 0));
        setLog((prev) => [
          `[${new Date().toLocaleTimeString()}] status=${data.request.statusLabel}`,
          ...prev,
        ].slice(0, 25));

        const effectiveStatus = Number(data.request.effectiveStatus ?? data.request.status ?? 0);
        if (effectiveStatus >= 3) {
          router.push(`/receiver/complete?id=${id}`);
        }
      } catch {
        setLog((prev) => [`[${new Date().toLocaleTimeString()}] waiting for backend...`, ...prev].slice(0, 25));
      }
    }, 3500);

    return () => {
      clearInterval(poll);
    };
  }, [id, router]);

  const steps = useMemo(() => payload?.escrowSteps || [], [payload]);

  return (
    <Shell title={`Receiver Live Session #${id || ""}`} subtitle="SOC charging, escrow steps, and live monospace log.">
      <section className="grid two">
        <article className="card">
          <h3>SOC progress</h3>
          <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${soc}%` }} /></div>
          <p className="muted" style={{ marginTop: 8 }}>{soc}%</p>

          <h3 style={{ marginTop: 16 }}>Escrow steps</h3>
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
