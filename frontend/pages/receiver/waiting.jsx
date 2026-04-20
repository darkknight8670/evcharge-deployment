import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../lib/layout";
import { getRequest } from "../../lib/api";

export default function ReceiverWaitingPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Broadcasting to nearby donors...");

  useEffect(() => {
    const id = router.query.id;
    if (!id) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const request = await getRequest(id);
        if (request.status >= 1) {
          router.push(`/receiver/session/${id}`);
          return;
        }
        setStatus(`Request #${id} is still open. Radius pulse expanding...`);
      } catch {
        setStatus("Waiting for chain sync...");
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <Shell title="Waiting for Match" subtitle="Expanding pulse indicates growing broadcast radius.">
      <section className="card">
        <div className="pulse-wrap">
          <div className="pulse" />
        </div>
        <p className="muted" style={{ textAlign: "center" }}>{status}</p>
      </section>
    </Shell>
  );
}
