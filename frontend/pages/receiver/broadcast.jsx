import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../lib/layout";
import { createReceiverBroadcast } from "../../lib/api";
import { connectWallet, ensureExpectedChain, ensureVerifiedUser, getContractClients, readableContractError } from "../../lib/web3";
import { loadSession } from "../../lib/session";

export default function ReceiverBroadcastPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    energyRequired: "20",
    pricePerUnitWei: "1000000000000000",
    tokenRate: "1000000000000000",
    radiusKm: "3",
    location: "Auto GPS",
    batteryCapacity: "",
  });

  useEffect(() => {
    const current = loadSession();
    if (!current || current.role !== "receiver") {
      router.replace("/dashboard");
      return;
    }

    setSession(current);
    setForm((prev) => ({ ...prev, batteryCapacity: current.batteryCapacity || "" }));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          setForm((prev) => ({
            ...prev,
            location: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          }));
        },
        () => {
          setError("Location access denied. You can still continue.");
        },
      );
    }
  }, [router]);

  const escrow = useMemo(() => {
    try {
      return (BigInt(form.energyRequired || 0) * BigInt(form.pricePerUnitWei || 0)).toString();
    } catch {
      return "0";
    }
  }, [form.energyRequired, form.pricePerUnitWei]);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  async function handleBroadcast(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const wallet = await connectWallet();
      const { escrow: escrowContract, registry, config } = await getContractClients(wallet.signer);
      await ensureExpectedChain(config);
      await ensureVerifiedUser(registry, wallet.address);

      const value = BigInt(form.energyRequired || 0) * BigInt(form.pricePerUnitWei || 0);
      const tx = await escrowContract.createRequest(
        form.energyRequired,
        form.pricePerUnitWei,
        form.location,
        { value },
      );

      const receipt = await tx.wait();
      const id = receipt?.logs?.[0]?.args?.id?.toString() || (await escrowContract.requestCount()).toString();

      await createReceiverBroadcast({
        address: wallet.address,
        requestId: id,
        kwhRequired: form.energyRequired,
        tokenRate: form.tokenRate,
        lat,
        lng,
        radiusKm: form.radiusKm,
      });

      router.push(`/receiver/waiting?id=${id}`);
    } catch (err) {
      const message = String(err?.shortMessage || err?.message || "Broadcast failed");
      if (/127\.0\.0\.1:8545|econnrefused/i.test(message)) {
        setError("MetaMask is connected to local Hardhat RPC (127.0.0.1:8545). Switch to Sepolia and retry.");
      } else {
        setError(readableContractError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Receiver Broadcast" subtitle="Battery fields, auto GPS, and escrow-funded request.">
      <form className="grid two" onSubmit={handleBroadcast}>
        <article className="card">
          <h3>Battery and pricing</h3>
          <div className="grid" style={{ marginTop: 10 }}>
            <label>
              Battery capacity (kWh)
              <input value={form.batteryCapacity} onChange={onChange("batteryCapacity")} />
            </label>
            <label>
              Energy required (kWh)
              <input type="number" min="1" value={form.energyRequired} onChange={onChange("energyRequired")} required />
            </label>
            <label>
              Price per unit (wei)
              <input value={form.pricePerUnitWei} onChange={onChange("pricePerUnitWei")} required />
            </label>
            <label>
              Token rate (wei)
              <input value={form.tokenRate} onChange={onChange("tokenRate")} required />
            </label>
            <label>
              Radius (km)
              <input type="number" min="1" value={form.radiusKm} onChange={onChange("radiusKm")} />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Escrow needed: <span className="mono">{escrow} wei</span></p>
        </article>

        <article className="card">
          <h3>Location</h3>
          <label style={{ marginTop: 10 }}>
            GPS location string
            <input value={form.location} onChange={onChange("location")} />
          </label>
          <div className="map-mini" style={{ marginTop: 12 }}>
            <div className="mono">
              {lat && lng ? `GPS ${lat}, ${lng}` : "Waiting for GPS..."}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" type="submit" disabled={loading}>{loading ? "Broadcasting..." : "Broadcast request"}</button>
          </div>
          {error ? <p style={{ color: "#ff9494", marginTop: 10 }}>{error}</p> : null}
        </article>
      </form>
    </Shell>
  );
}
