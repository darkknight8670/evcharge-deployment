const express = require("express");
const cors = require("cors");
const {
  provider,
  rpcUrl,
  getAddresses,
  getAbi,
  getSummary,
  getRecentRequests,
  getOpenBroadcasts,
  getEscrowContract,
  getValidatorEscrowContract,
  getRegistryContract,
  getUserProfile,
  readRequest,
} = require("./services/contracts");
const {
  getSession,
  listSessions,
  setSession,
  setProfile,
  getProfile,
  listProfiles,
  saveBroadcast,
  getBroadcast,
  listBroadcasts,
  setRequestProgress,
  getRequestProgress,
  listRequestProgress,
  setTelemetry,
  getTelemetry,
  listTelemetry,
} = require("./services/store");

require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const ADMIN_WALLET = "0x389f141512610d5Db0A55cA8924405Dc842AE0F1".toLowerCase();
const CONTROL_SERVER_BASE_URL = process.env.CONTROL_SERVER_URL || "http://127.0.0.1:5000";
const CONTROL_SERVER_ON_PATH = process.env.CONTROL_SERVER_ON_PATH || "/on";
const CONTROL_SERVER_OFF_PATH = process.env.CONTROL_SERVER_OFF_PATH || "/off";
const CONTROL_SERVER_TIMEOUT_MS = Number(process.env.CONTROL_SERVER_TIMEOUT_MS || 5000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const chargingTimers = new Map();
const runtimeLogs = [];

function addLog(message, level = "info") {
  const entry = {
    ts: Date.now(),
    level,
    message: String(message),
  };
  runtimeLogs.push(entry);
  if (runtimeLogs.length > 500) {
    runtimeLogs.shift();
  }
}

function adminAccessGranted(address) {
  return String(address || "").toLowerCase() === ADMIN_WALLET;
}

function normalizeTelemetryPayload(body = {}) {
  const voltage = Number(body.voltage);
  const current = Number(body.current);
  const power = Number(body.power);
  const timestamp = body.timestamp ? String(body.timestamp) : new Date().toLocaleTimeString();

  return {
    voltage: Number.isFinite(voltage) ? voltage : null,
    current: Number.isFinite(current) ? current : null,
    power: Number.isFinite(power) ? power : null,
    timestamp,
  };
}

async function resolveRequiredEnergyKwh(requestId) {
  const local = getBroadcast(requestId);
  const localKwh = Number(local?.kwhRequired);
  if (Number.isFinite(localKwh) && localKwh > 0) {
    return localKwh;
  }

  try {
    const request = await readRequest(getEscrowContract(), requestId);
    const chainKwh = Number(request.energyRequired);
    if (Number.isFinite(chainKwh) && chainKwh > 0) {
      return chainKwh;
    }
  } catch {
    // Request might be local-only simulation data.
  }

  return null;
}

async function getPaymentTxHash(requestId) {
  try {
    const escrow = getEscrowContract();
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 100000);
    const filter = escrow.filters.PaidOut(BigInt(requestId));
    const events = await escrow.queryFilter(filter, fromBlock, latestBlock);
    const latestEvent = events[events.length - 1];
    return latestEvent?.transactionHash || null;
  } catch {
    return null;
  }
}

async function startChargingOnChain(requestId) {
  const readEscrow = getEscrowContract();
  const request = await readRequest(readEscrow, requestId);
  const status = Number(request.status || 0);

  if (status >= 2) {
    return;
  }
  if (status !== 1) {
    throw new Error("Request must be ACCEPTED before starting charging");
  }

  const { escrow } = getValidatorEscrowContract();
  const tx = await escrow.startCharging(requestId);
  const receipt = await tx.wait();
  const message = `[CHAIN] startCharging request #${requestId} tx: ${receipt.hash}`;
  console.log(message);
  addLog(message);
}

async function completeChargingOnChain(requestId, energyDelivered) {
  const { escrow } = getValidatorEscrowContract();
  const tx = await escrow.completeCharging(requestId, energyDelivered);
  const receipt = await tx.wait();
  const txHash = receipt.hash;
  const chainMessage = `[CHAIN] completeCharging request #${requestId} tx: ${txHash}`;
  const paymentMessage = `[PAYMENT] Request #${requestId} payment transaction hash: ${txHash}`;
  console.log(chainMessage);
  console.log(paymentMessage);
  addLog(chainMessage);
  addLog(paymentMessage);
  return txHash;
}

function stopSimulation(requestId) {
  const existing = chargingTimers.get(requestId);
  if (existing) {
    clearInterval(existing);
    chargingTimers.delete(requestId);
  }
}

function normalizeControlPath(path) {
  const value = String(path || "").trim();
  if (!value) {
    return "/";
  }
  return value.startsWith("/") ? value : `/${value}`;
}

async function sendControlSignal(action, requestId) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable on this Node.js runtime");
  }

  const controlPath = action === "on" ? CONTROL_SERVER_ON_PATH : CONTROL_SERVER_OFF_PATH;
  const endpoint = new URL(normalizeControlPath(controlPath), CONTROL_SERVER_BASE_URL).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTROL_SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Control server responded with ${response.status}`);
    }

    const message = `[CONTROL] Request #${requestId} -> ${action.toUpperCase()} (${endpoint})`;
    console.log(message);
    addLog(message);
  } catch (error) {
    const message = `[CONTROL] Request #${requestId} -> ${action.toUpperCase()} failed: ${error.message}`;
    console.log(message);
    addLog(message, "error");
    throw new Error(`Charging control signal ${action.toUpperCase()} failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function buildSimulatedTelemetry(soc) {
  const boundedSoc = Math.max(0, Math.min(100, Number(soc || 0)));
  const voltage = Number((228 + (boundedSoc / 100) * 8).toFixed(1));
  const current = Number((8 + (boundedSoc / 100) * 7).toFixed(1));
  const power = Number((voltage * current).toFixed(1));

  return {
    voltage,
    current,
    power,
    timestamp: new Date().toLocaleTimeString(),
    source: "sim",
  };
}

async function runChargingSimulation(requestId) {
  const requiredKwh = await resolveRequiredEnergyKwh(requestId);
  if (!Number.isFinite(requiredKwh) || requiredKwh <= 0) {
    throw new Error(`Unable to resolve required energy for request #${requestId}`);
  }

  stopSimulation(requestId);

  setRequestProgress(requestId, {
    started: true,
    completed: false,
    soc: 0,
    telemetry: buildSimulatedTelemetry(0),
    paymentTxHash: null,
    updatedAt: Date.now(),
  });

  const timer = setInterval(async () => {
    const current = getRequestProgress(requestId) || {};
    const currentSoc = Number(current.soc || 0);
    const nextSoc = Math.min(100, currentSoc + 10);
    const started = nextSoc > 0;
    const completed = nextSoc >= 100;
    const simulatedEnergy = (requiredKwh * nextSoc) / 100;

    const message = `[SIM] Request #${requestId} | SOC ${nextSoc.toFixed(1)}% | Simulated energy ${simulatedEnergy.toFixed(2)} / ${requiredKwh.toFixed(2)} kWh`;
    console.log(message);
    addLog(message);

    const payload = {
      soc: nextSoc,
      started,
      completed,
      completedAt: completed ? Date.now() : null,
      telemetry: current.telemetry && current.telemetry.source !== "sim"
        ? current.telemetry
        : buildSimulatedTelemetry(nextSoc),
    };

    if (completed) {
      stopSimulation(requestId);
      try {
        await sendControlSignal("off", requestId);
      } catch {
        // Completion flow should continue even if hardware off command fails.
      }
      try {
        const paymentTxHash = await completeChargingOnChain(requestId, Math.round(requiredKwh));
        payload.paymentTxHash = paymentTxHash;
      } catch (error) {
        payload.paymentTxHash = null;
        const message = `[PAYMENT] Request #${requestId} completion reached, but payout tx failed: ${error.message}`;
        console.log(message);
        addLog(message, "error");
      }
    }

    setRequestProgress(requestId, payload);
  }, 2500);

  chargingTimers.set(requestId, timer);
}

app.get("/api/health", async (_, res) => {
  try {
    const network = await provider.getNetwork();
    res.json({ ok: true, chainId: network.chainId.toString(), rpcUrl });
  } catch (error) {
    res.json({ ok: false, chainId: null, rpcUrl, error: error.message });
  }
});

app.get("/api/contracts", async (_, res) => {
  try {
    let chainId = null;
    let networkError = null;
    try {
      const network = await provider.getNetwork();
      chainId = network.chainId.toString();
    } catch (error) {
      networkError = error.message;
    }

    res.json({
      addresses: getAddresses(),
      abis: {
        escrow: getAbi(require("path").join(__dirname, "data", "abis", "EVChargingEscrow.json")),
        registry: getAbi(require("path").join(__dirname, "data", "abis", "Userregistry.json")),
      },
      chainId,
      rpcUrl,
      networkError,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/summary", async (_, res) => {
  try {
    res.json(await getSummary());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { address, name, email, evModel, batteryCapacity } = req.body;
    if (!address || !name || !email || !evModel || !batteryCapacity) {
      return res.status(400).json({ error: "address, name, email, evModel and batteryCapacity are required" });
    }

    const profile = { address, name, email, evModel, batteryCapacity };
    setSession(address, profile);
    setProfile(address, profile);

    res.json({ ok: true, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/register-user", async (req, res) => {
  try {
    const { adminAddress, address, name, email, evModel, batteryCapacity } = req.body;
    if (!adminAccessGranted(adminAddress)) {
      return res.status(403).json({ error: "Admin access denied" });
    }

    if (!address || !name || !email || !evModel || !batteryCapacity) {
      return res.status(400).json({ error: "address, name, email, evModel and batteryCapacity are required" });
    }

    const profile = { address, name, email, evModel, batteryCapacity, createdBy: adminAddress };
    setSession(address, profile);
    setProfile(address, profile);
    addLog(`[ADMIN] Registered local user profile for ${address}`);

    res.json({ ok: true, profile });
  } catch (error) {
    addLog(`[ADMIN] Register user failed: ${error.message}`, "error");
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/transactions", async (req, res) => {
  try {
    const adminAddress = req.query.adminAddress;
    if (!adminAccessGranted(adminAddress)) {
      return res.status(403).json({ error: "Admin access denied" });
    }

    const requestedLimit = Number(req.query.limit || 200);
    const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
    const recent = await getRecentRequests(limit);
    const progress = listRequestProgress();

    res.json({
      total: recent.total,
      chainTransactions: recent.items,
      progress,
    });
  } catch (error) {
    addLog(`[ADMIN] Fetch transactions failed: ${error.message}`, "error");
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/logs", async (req, res) => {
  try {
    const adminAddress = req.query.adminAddress;
    if (!adminAccessGranted(adminAddress)) {
      return res.status(403).json({ error: "Admin access denied" });
    }

    const localProfiles = listProfiles();
    const localSessions = listSessions();

    res.json({
      logs: [...runtimeLogs].reverse(),
      localProfiles,
      localSessions,
    });
  } catch (error) {
    addLog(`[ADMIN] Fetch logs failed: ${error.message}`, "error");
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/profile/:address", async (req, res) => {
  try {
    const localProfile = getProfile(req.params.address);
    const chainProfile = await getUserProfile(req.params.address);
    res.json({
      localProfile,
      chainProfile,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/receiver/broadcasts", async (_, res) => {
  try {
    const onChain = await getOpenBroadcasts(40);
    const local = listBroadcasts();
    res.json({ onChain, local });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/receiver/broadcast", async (req, res) => {
  try {
    const { address, requestId, kwhRequired, tokenRate, lat, lng, radiusKm } = req.body;
    if (!address || !requestId || !kwhRequired || !tokenRate) {
      return res.status(400).json({ error: "address, requestId, kwhRequired and tokenRate are required" });
    }

    const payload = {
      id: String(requestId),
      address,
      kwhRequired,
      tokenRate,
      lat: lat || null,
      lng: lng || null,
      radiusKm: radiusKm || 3,
      status: "BROADCASTING",
    };

    saveBroadcast(payload);
    res.json({ ok: true, broadcast: payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/request/:id", async (req, res) => {
  try {
    const escrow = getEscrowContract();
    const request = await readRequest(escrow, req.params.id);
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/history/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const recent = await getRecentRequests(100);
    const history = recent.items.filter(
      (item) => item.receiver.toLowerCase() === address || item.donor.toLowerCase() === address,
    );
    res.json({ total: history.length, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/donor/feed", async (_, res) => {
  try {
    const feed = await getOpenBroadcasts(50);
    const local = listBroadcasts();

    const merged = [...feed];
    for (const item of local) {
      if (!merged.find((f) => String(f.id) === String(item.id))) {
        merged.push({
          id: item.id,
          receiver: item.address,
          donor: "0x0000000000000000000000000000000000000000",
          energyRequired: String(item.kwhRequired),
          pricePerUnitWei: String(item.tokenRate),
          escrowBalance: "0",
          status: 0,
          statusLabel: "OPEN",
          location: `${item.lat || "NA"}, ${item.lng || "NA"}`,
          matched: false,
          distanceKm: (Math.random() * 7 + 0.3).toFixed(2),
        });
      }
    }

    res.json({ total: merged.length, items: merged });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/session/:id", async (req, res) => {
  try {
    const requestId = String(req.params.id);
    const onChain = await readRequest(getEscrowContract(), requestId);
    const local = getBroadcast(requestId);
    const progress = getRequestProgress(requestId) || {};
    const latestTelemetry = getTelemetry("latest");
    const requestTelemetry = getTelemetry(requestId);
    const telemetry =
      progress.telemetry
      || requestTelemetry
      || latestTelemetry
      || (progress.started ? buildSimulatedTelemetry(progress.soc || 0) : null);
    const effectiveProgress = telemetry ? { ...progress, telemetry } : progress;
    const effectiveStatus = Math.max(
      Number(onChain.status || 0),
      effectiveProgress.completed ? 3 : effectiveProgress.started ? 2 : 0,
    );

    res.json({
      request: {
        ...onChain,
        effectiveStatus,
        effectiveStatusLabel: ["OPEN", "ACCEPTED", "CHARGING", "COMPLETED"][effectiveStatus] || onChain.statusLabel,
      },
      local,
      progress: effectiveProgress,
      escrowSteps: [
        { step: "Escrow funded", done: Number(onChain.escrowBalance) > 0 || onChain.status >= 1 },
        { step: "Donor accepted", done: onChain.status >= 1 },
        { step: "Charging started", done: onChain.status >= 2 || !!effectiveProgress.started },
        { step: "Session completed", done: onChain.status >= 3 || !!effectiveProgress.completed },
      ],
      control: {
        simulating: chargingTimers.has(requestId),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/session/:id/start", async (req, res) => {
  try {
    const requestId = String(req.params.id);
    const progress = getRequestProgress(requestId) || {};
    if (progress.completed) {
      return res.json({ ok: true, id: requestId, started: true, completed: true, paymentTxHash: progress.paymentTxHash || null });
    }
    if (chargingTimers.has(requestId)) {
      return res.json({ ok: true, id: requestId, started: true, completed: false });
    }

    await startChargingOnChain(requestId);
    await sendControlSignal("on", requestId);
    await runChargingSimulation(requestId);
    res.json({ ok: true, id: requestId, started: true, completed: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/session/:id/stop", async (req, res) => {
  try {
    const requestId = String(req.params.id);
    stopSimulation(requestId);
    await sendControlSignal("off", requestId);

    const previous = getRequestProgress(requestId) || {};
    setRequestProgress(requestId, {
      started: false,
      completed: Boolean(previous.completed),
      stoppedAt: Date.now(),
    });

    res.json({ ok: true, id: requestId, started: false, completed: Boolean(previous.completed) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/session/:id/progress", async (req, res) => {
  try {
    const requestId = String(req.params.id);
    const soc = Number(req.body?.soc);
    if (!Number.isFinite(soc)) {
      return res.status(400).json({ error: "soc is required" });
    }

    const boundedSoc = Math.max(0, Math.min(100, soc));
    const started = boundedSoc > 0;
    const completed = boundedSoc >= 100;
    const previous = getRequestProgress(requestId) || {};

    const requiredKwh = await resolveRequiredEnergyKwh(requestId);
    if (Number.isFinite(requiredKwh) && boundedSoc !== previous.soc) {
      const simulatedEnergy = (requiredKwh * boundedSoc) / 100;
      const message = `[SIM] Request #${requestId} | SOC ${boundedSoc.toFixed(1)}% | Simulated energy ${simulatedEnergy.toFixed(2)} / ${requiredKwh.toFixed(2)} kWh`;
      console.log(message);
      addLog(message);
    }

    const progressPayload = {
      soc: boundedSoc,
      started,
      completed,
      completedAt: completed ? Date.now() : null,
      telemetry: previous.telemetry && previous.telemetry.source !== "sim"
        ? previous.telemetry
        : buildSimulatedTelemetry(boundedSoc),
    };

    if (completed && !previous.completed) {
      const paymentTxHash = await getPaymentTxHash(requestId);
      if (paymentTxHash) {
        progressPayload.paymentTxHash = paymentTxHash;
        const message = `[PAYMENT] Request #${requestId} payment transaction hash: ${paymentTxHash}`;
        console.log(message);
        addLog(message);
      } else {
        const message = `[PAYMENT] Request #${requestId} completed in simulation. Payment transaction hash not found on-chain yet.`;
        console.log(message);
        addLog(message);
      }
    }

    setRequestProgress(requestId, progressPayload);

    res.json({ ok: true, id: requestId, soc: boundedSoc, started, completed, paymentTxHash: progressPayload.paymentTxHash || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pi/telemetry", async (req, res) => {
  try {
    const requestId = req.body?.requestId ?? req.body?.sessionId ?? null;
    const telemetry = normalizeTelemetryPayload(req.body || {});
    const receivedAt = Date.now();
    const record = {
      ...telemetry,
      requestId: requestId ? String(requestId) : null,
      receivedAt,
    };

    setTelemetry("latest", record);

    if (requestId) {
      setTelemetry(String(requestId), record);
      setRequestProgress(String(requestId), {
        telemetry: record,
        updatedAt: receivedAt,
      });
    }

    res.json({ ok: true, telemetry: record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pi/telemetry", async (_, res) => {
  try {
    res.json({
      latest: getTelemetry("latest"),
      history: listTelemetry(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  const message = `Backend API listening on http://localhost:${port}`;
  console.log(message);
  addLog(message);
});
