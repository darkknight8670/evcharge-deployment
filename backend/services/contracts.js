const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") }); // Fallback to root .env if it exists

const addressesPath = path.join(rootDir, "data", "Addresses.json");
const escrowArtifactPath = path.join(rootDir, "data", "abis", "EVChargingEscrow.json");
const registryArtifactPath = path.join(rootDir, "data", "abis", "Userregistry.json");

const statusLabels = ["OPEN", "ACCEPTED", "CHARGING", "COMPLETED", "CANCELED", "REFUNDED"];

const defaultRpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || defaultRpcUrl;
const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
const validatorPrivateKey =
  process.env.VALIDATOR_PRIVATE_KEY ||
  process.env.BACKEND_VALIDATOR_PRIVATE_KEY ||
  process.env.ORACLE_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  "";

function readJson(filePath, fallbackValue = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function getAddresses() {
  const json = readJson(addressesPath, {});
  return {
    UserRegistry: process.env.REGISTRY_ADDRESS || process.env.USER_REGISTRY_ADDRESS || json.UserRegistry,
    EVChargingEscrow: process.env.ESCROW_ADDRESS || json.EVChargingEscrow,
    Validator: process.env.VALIDATION_ADDRESS || json.Validator,
    FeeReceiver: process.env.FEE_RECEIVER_ADDRESS || json.FeeReceiver,
  };
}

function getAbi(filePath) {
  const artifact = readJson(filePath, {});
  return artifact.abi || [];
}

function getEscrowContract() {
  const addresses = getAddresses();
  if (!addresses.EVChargingEscrow) {
    throw new Error("EVChargingEscrow address missing in Addresses.json");
  }
  return new ethers.Contract(addresses.EVChargingEscrow, getAbi(escrowArtifactPath), provider);
}

function getValidatorEscrowContract() {
  if (!validatorPrivateKey) {
    throw new Error("VALIDATOR_PRIVATE_KEY (or BACKEND_VALIDATOR_PRIVATE_KEY) is required for backend charging simulation");
  }

  const signer = new ethers.Wallet(validatorPrivateKey, provider);
  const addresses = getAddresses();
  if (!addresses.EVChargingEscrow) {
    throw new Error("EVChargingEscrow address missing in Addresses.json");
  }

  return {
    signer,
    escrow: new ethers.Contract(addresses.EVChargingEscrow, getAbi(escrowArtifactPath), signer),
  };
}

function getRegistryContract() {
  const addresses = getAddresses();
  if (!addresses.UserRegistry) {
    throw new Error("UserRegistry address missing in Addresses.json");
  }
  return new ethers.Contract(addresses.UserRegistry, getAbi(registryArtifactPath), provider);
}

function toPlain(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item));
  }

  if (value && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^\\d+$/.test(key)) {
        result[key] = toPlain(item);
      }
    }
    return result;
  }

  return value;
}

async function readRequest(escrow, id) {
  const request = await escrow.requests(id);
  const escrowBalance = await escrow.escrowBalance(id);
  const status = Number(request.status);

  return {
    id: request.id.toString(),
    receiver: request.receiver,
    donor: request.donor,
    energyRequired: request.energyRequired.toString(),
    pricePerUnitWei: request.pricePerUnitWei.toString(),
    createdAt: request.createdAt.toString(),
    acceptedAt: request.acceptedAt.toString(),
    startedAt: request.startedAt.toString(),
    completedAt: request.completedAt.toString(),
    energyDelivered: request.energyDelivered.toString(),
    location: request.location,
    status,
    statusLabel: statusLabels[status] || "UNKNOWN",
    escrowBalance: escrowBalance.toString(),
  };
}

async function getSummary() {
  const addresses = getAddresses();

  try {
    const escrow = getEscrowContract();
    const network = await provider.getNetwork();

    return {
      network: {
        chainId: network.chainId.toString(),
        rpcUrl,
      },
      addresses,
      owner: await escrow.owner(),
      validator: await escrow.validator(),
      feeReceiver: await escrow.feeReceiver(),
      feeBps: (await escrow.feeBps()).toString(),
      paused: await escrow.paused(),
      requestCount: (await escrow.requestCount()).toString(),
      acceptTimeout: (await escrow.acceptTimeout()).toString(),
      chargingTimeout: (await escrow.chargingTimeout()).toString(),
      networkError: null,
    };
  } catch (error) {
    return {
      network: {
        chainId: null,
        rpcUrl,
      },
      addresses,
      owner: null,
      validator: addresses.Validator || null,
      feeReceiver: addresses.FeeReceiver || null,
      feeBps: null,
      paused: null,
      requestCount: "0",
      acceptTimeout: null,
      chargingTimeout: null,
      networkError: error.message,
    };
  }
}

async function getRecentRequests(limit = 20) {
  try {
    const escrow = getEscrowContract();
    const count = Number(await escrow.requestCount());
    const items = [];

    for (let id = count; id >= 1 && items.length < limit; id -= 1) {
      items.push(await readRequest(escrow, id));
    }

    return { total: count, items };
  } catch {
    // If RPC is unavailable, return an empty chain feed and let API callers merge local data.
    return { total: 0, items: [] };
  }
}

async function getOpenBroadcasts(limit = 20) {
  const recent = await getRecentRequests(100);
  return recent.items
    .filter((item) => item.status === 0 || item.status === 1)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      matched: item.donor && item.donor !== ethers.ZeroAddress,
      distanceKm: (Math.random() * 8 + 0.5).toFixed(2),
    }));
}

async function getUserProfile(address) {
  const registry = getRegistryContract();
  const user = await registry.getuser(address);
  const verified = await registry.isvarifieduser(address);
  return {
    user: toPlain(user),
    verified,
  };
}

module.exports = {
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
};
