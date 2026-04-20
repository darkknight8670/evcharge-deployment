import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../lib/layout";
import { adminRegisterUser, getAdminLogs, getAdminTransactions } from "../lib/api";
import { connectWallet, getContractClients } from "../lib/web3";
import { loadSession } from "../lib/session";

const ADMIN_WALLET = "0x389f141512610d5Db0A55cA8924405Dc842AE0F1".toLowerCase();

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [progress, setProgress] = useState([]);
  const [logs, setLogs] = useState([]);
  const [localProfiles, setLocalProfiles] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [registryAdmin, setRegistryAdmin] = useState("");
  const [verifyTarget, setVerifyTarget] = useState("");
  const [form, setForm] = useState({
    address: "",
    name: "",
    email: "",
    evModel: "",
    batteryCapacity: "",
  });

  useEffect(() => {
    const current = loadSession();
    setSession(current);

    if (!current?.address) {
      router.replace("/login");
      return;
    }

    if (current.address.toLowerCase() !== ADMIN_WALLET) {
      router.replace("/dashboard");
      return;
    }

    setVerifyTarget(current.address);

    loadAdminData(current.address).finally(() => setLoading(false));
  }, [router]);

  async function refreshRegistryAdmin() {
    const wallet = await connectWallet();
    const { registry } = await getContractClients(wallet.provider);
    const admin = await registry.admin();
    setRegistryAdmin(admin);
    return { wallet, admin };
  }

  async function verifyAddressByAdmin() {
    try {
      setVerifying(true);
      setError("");
      setStatus("");

      if (!verifyTarget) {
        throw new Error("Provide a wallet address to verify");
      }

      const { wallet, admin } = await refreshRegistryAdmin();
      if (wallet.address.toLowerCase() !== admin.toLowerCase()) {
        throw new Error(`Only admin can verify users. Admin wallet: ${admin}`);
      }

      const { registry } = await getContractClients(wallet.signer);
      const tx = await registry.varifyuser(verifyTarget);
      await tx.wait();
      setStatus(`Address verified on-chain: ${verifyTarget}`);
    } catch (err) {
      setError(err.shortMessage || err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function loadAdminData(adminAddress) {
    try {
      setRefreshing(true);
      setError("");
      const [txResult, logResult] = await Promise.allSettled([
        getAdminTransactions(adminAddress, 300),
        getAdminLogs(adminAddress),
      ]);

      const errors = [];

      if (txResult.status === "fulfilled") {
        const txData = txResult.value || {};
        setTransactions(txData.chainTransactions || []);
        setProgress(txData.progress || []);
      } else {
        setTransactions([]);
        setProgress([]);
        errors.push(`Transactions: ${txResult.reason?.message || "failed"}`);
      }

      if (logResult.status === "fulfilled") {
        const logData = logResult.value || {};
        setLogs(logData.logs || []);
        setLocalProfiles(logData.localProfiles || []);
      } else {
        setLogs([]);
        setLocalProfiles([]);
        errors.push(`Logs: ${logResult.reason?.message || "failed"}`);
      }

      if (errors.length) {
        setError(errors.join(" | "));
      }
    } catch (err) {
      setError(err.message || "Unable to load admin data");
    } finally {
      setRefreshing(false);
    }
  }

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  async function handleRegister(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setStatus("");

      await adminRegisterUser({
        adminAddress: session.address,
        ...form,
      });

      setStatus("User registered in backend store successfully.");
      setForm({
        address: "",
        name: "",
        email: "",
        evModel: "",
        batteryCapacity: "",
      });

      await loadAdminData(session.address);
    } catch (err) {
      setError(err.message || "User registration failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Shell title="Admin Panel" subtitle="Loading admin workspace...">
        <section className="card">
          <p className="muted">Checking admin access...</p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell title="Admin Panel" subtitle="Register users and monitor transactions/logs.">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>Register user (admin)</h3>
          <button className="ghost" onClick={() => loadAdminData(session.address)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        <form onSubmit={handleRegister} style={{ marginTop: 10 }}>
          <div className="grid two">
            <label>
              Wallet address
              <input className="mono" value={form.address} onChange={onChange("address")} required />
            </label>
            <label>
              Name
              <input value={form.name} onChange={onChange("name")} required />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={onChange("email")} required />
            </label>
            <label>
              EV model
              <input value={form.evModel} onChange={onChange("evModel")} required />
            </label>
            <label>
              Battery capacity (kWh)
              <input type="number" min="1" value={form.batteryCapacity} onChange={onChange("batteryCapacity")} required />
            </label>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Registering..." : "Register user"}
            </button>
            <span className="mono">Admin: {session?.address}</span>
          </div>
        </form>

        {status ? <p style={{ color: "#4caf50", marginTop: 10 }}>{status}</p> : null}
        {error ? <p style={{ color: "#ff9f9f", marginTop: 10 }}>{error}</p> : null}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Admin verify (Userregistry)</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Verify users on-chain using the registry admin wallet.
        </p>
        <div className="kv" style={{ marginTop: 8 }}>
          <div className="item"><span>Registry admin</span><span className="mono">{registryAdmin || "unknown"}</span></div>
          <div className="item"><span>Connected session</span><span className="mono">{session?.address || "-"}</span></div>
        </div>
        <label style={{ marginTop: 10, display: "block" }}>
          Address to verify
          <input className="mono" value={verifyTarget} onChange={(event) => setVerifyTarget(event.target.value)} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="ghost" onClick={refreshRegistryAdmin}>Load registry admin</button>
          <button onClick={verifyAddressByAdmin} disabled={verifying}>{verifying ? "Verifying..." : "Verify address"}</button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>All transactions</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Latest on-chain requests with current status and payment hashes.
        </p>
        <div className="log" style={{ marginTop: 8 }}>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(transactions, null, 2)}
          </pre>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Charging progress</h3>
        <div className="log" style={{ marginTop: 8 }}>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(progress, null, 2)}
          </pre>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Runtime logs</h3>
        <div className="log" style={{ marginTop: 8 }}>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(logs, null, 2)}
          </pre>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Registered local profiles</h3>
        <div className="log" style={{ marginTop: 8 }}>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(localProfiles, null, 2)}
          </pre>
        </div>
      </section>
    </Shell>
  );
}
