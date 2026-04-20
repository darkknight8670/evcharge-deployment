import { useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../lib/layout";
import { connectWallet } from "../lib/web3";
import { loginProfile } from "../lib/api";
import { saveSession } from "../lib/session";

const ADMIN_WALLET = "0x389f141512610d5Db0A55cA8924405Dc842AE0F1".toLowerCase();

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    evModel: "",
    batteryCapacity: "",
  });
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  async function handleConnect() {
    try {
      setError("");
      const wallet = await connectWallet({ forceSelection: true });
      setAddress(wallet.address);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const wallet = await connectWallet({ forceSelection: true });
      const selectedAddress = wallet.address;
      setAddress(selectedAddress);

      const payload = { ...form, address: selectedAddress };
      await loginProfile(payload);
      saveSession({ ...payload, role: null });
      if (selectedAddress.toLowerCase() === ADMIN_WALLET) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const message = String(err?.message || "Login failed");
      if (/failed to fetch|backend api/i.test(message.toLowerCase())) {
        setError("Cannot reach backend. Start backend on port 4000, then try again.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Login / Register" subtitle="Use one page to create or continue your account with MetaMask.">
      <form className="card" onSubmit={handleSubmit}>
        <div className="grid two">
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

        <div className="row" style={{ marginTop: 14 }}>
          <button type="button" className="ghost" onClick={handleConnect}>Connect MetaMask</button>
          <span className="mono">{address || "wallet not connected"}</span>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" type="submit" disabled={loading}>{loading ? "Saving..." : "Login / Register"}</button>
        </div>

        {error ? <p style={{ color: "#ff9393", marginTop: 10 }}>{error}</p> : null}
      </form>
    </Shell>
  );
}
