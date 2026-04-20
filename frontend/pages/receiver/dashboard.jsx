import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../lib/layout";
import { getProfile } from "../../lib/api";
import { loadSession } from "../../lib/session";

export default function ReceiverDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [verified, setVerified] = useState(null);

  useEffect(() => {
    const current = loadSession();
    if (!current || current.role !== "receiver") {
      router.replace("/dashboard");
      return;
    }
    setSession(current);

    getProfile(current.address)
      .then((data) => setVerified(Boolean(data?.chainProfile?.verified)))
      .catch(() => setVerified(false));
  }, [router]);

  return (
    <Shell title="Receiver Dashboard" subtitle="New request, active session, or past history.">
      <section className="grid two">
        <article className="card role-green">
          <h2>New request</h2>
          <p className="muted" style={{ marginTop: 8 }}>Broadcast energy needs with location and escrow details.</p>
          {verified === false ? (
            <>
              <p style={{ color: "#ffb0b0", marginTop: 10 }}>
                Wallet not verified in Userregistry. Open Profile and complete verification first.
              </p>
              <Link href="/profile"><button style={{ marginTop: 12 }}>Open Profile</button></Link>
            </>
          ) : (
            <Link href="/receiver/broadcast"><button className="primary" style={{ marginTop: 12 }}>Create Broadcast</button></Link>
          )}
        </article>

        <article className="card role-green">
          <h2>Active session</h2>
          <p className="muted" style={{ marginTop: 8 }}>Jump to a live request session by ID.</p>
          <Link href="/receiver/waiting"><button className="primary" style={{ marginTop: 12 }}>Open Waiting Room</button></Link>
        </article>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Account snapshot</h3>
        <div className="kv" style={{ marginTop: 8 }}>
          <div className="item"><span>Name</span><span>{session?.name || "-"}</span></div>
          <div className="item"><span>Battery capacity</span><span>{session?.batteryCapacity || "-"} kWh</span></div>
          <div className="item"><span>Address</span><span className="mono">{session?.address || "-"}</span></div>
          <div className="item"><span>Verification</span><span>{verified === null ? "Checking..." : verified ? "Verified" : "Not verified"}</span></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link href="/history"><button>History</button></Link>
        </div>
      </section>
    </Shell>
  );
}
