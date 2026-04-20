import { useEffect, useState } from "react";
import { Shell } from "../lib/layout";
import { getProfile } from "../lib/api";
import { connectWallet, getContractClients } from "../lib/web3";
import { clearSession, loadSession, saveSession } from "../lib/session";

export default function ProfilePage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = loadSession();
    setSession(current);
    if (!current?.address) {
      return;
    }

    getProfile(current.address).then(setProfile).catch(() => setProfile(null));
  }, []);

  async function registerOnChain() {
    try {
      setSaving(true);
      setError("");
      if (!session) {
        throw new Error("Login required");
      }

      const wallet = await connectWallet();
      const { registry } = await getContractClients(wallet.signer);
      const role = session.role === "donor" ? 1 : session.role === "receiver" ? 2 : 3;
      const tx = await registry.register_user(session.evModel || "EV", session.batteryCapacity || 1, role);
      await tx.wait();
      const refreshed = await getProfile(session.address);
      setProfile(refreshed);
    } catch (err) {
      setError(err.shortMessage || err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateBattery(event) {
    if (!session) {
      return;
    }
    const next = { ...session, batteryCapacity: event.target.value };
    setSession(next);
    saveSession(next);
  }

  return (
    <Shell title="Profile" subtitle="Local identity and on-chain registry details.">
      <section className="card">
        {!session ? (
          <p className="muted">No active session. Login first.</p>
        ) : (
          <>
            <div className="kv">
              <div className="item"><span>Name</span><span>{session.name}</span></div>
              <div className="item"><span>Email</span><span>{session.email}</span></div>
              <div className="item"><span>Wallet</span><span className="mono">{session.address}</span></div>
              <div className="item"><span>EV model</span><span>{session.evModel}</span></div>
              <div className="item"><span>Verification</span><span>{profile?.chainProfile?.verified ? "Verified" : "Not verified"}</span></div>
              <div className="item">
                <span>Battery capacity</span>
                <input style={{ maxWidth: 160 }} value={session.batteryCapacity || ""} onChange={updateBattery} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" onClick={registerOnChain} disabled={saving}>{saving ? "Registering..." : "Register on-chain"}</button>
              <button onClick={() => { clearSession(); setSession(null); }}>Logout</button>
            </div>

            {error ? <p style={{ color: "#ff9f9f", marginTop: 10 }}>{error}</p> : null}
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>On-chain profile</h3>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      </section>
    </Shell>
  );
}
