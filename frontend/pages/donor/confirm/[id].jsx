import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "../../../lib/layout";
import { getRequest } from "../../../lib/api";
import { connectWallet, ensureVerifiedUser, getContractClients, readableContractError } from "../../../lib/web3";

export default function DonorConfirmPage() {
  const router = useRouter();
  const id = router.query.id;
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    getRequest(id).then(setRequest).catch((err) => setError(err.message));
  }, [id]);

  async function acceptRequest() {
    try {
      setLoading(true);
      setError("");
      const wallet = await connectWallet();
      const { escrow, registry } = await getContractClients(wallet.signer);
      await ensureVerifiedUser(registry, wallet.address);
      const tx = await escrow.acceptRequest(id);
      await tx.wait();
      router.push(`/donor/session/${id}`);
    } catch (err) {
      setError(readableContractError(err));
    } finally {
      setLoading(false);
    }
  }

  const matched = request && request.donor && request.donor !== "0x0000000000000000000000000000000000000000";

  return (
    <Shell title={`Confirm Request #${id || ""}`} subtitle="Confirm terms before accepting.">
      <section className="card">
        <div className="kv">
          <div className="item"><span>Receiver</span><span className="mono">{request?.receiver || "-"}</span></div>
          <div className="item"><span>Energy needed</span><span>{request?.energyRequired || "-"} kWh</span></div>
          <div className="item"><span>Rate</span><span className="mono">{request?.pricePerUnitWei || "-"}</span></div>
          <div className="item"><span>Status</span><span>{request?.statusLabel || "-"}</span></div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="amber" disabled={loading || matched} onClick={acceptRequest}>
            {matched ? "Already matched" : loading ? "Accepting..." : "Accept request"}
          </button>
        </div>

        {error ? <p style={{ color: "#ff9b9b", marginTop: 10 }}>{error}</p> : null}
      </section>
    </Shell>
  );
}
