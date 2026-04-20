import { ethers } from "ethers";
import { getContractsConfig } from "./api";

export async function connectWallet(options = {}) {
  if (!window.ethereum) {
    throw new Error("MetaMask not detected");
  }

  const { forceSelection = false } = options;

  if (forceSelection) {
    try {
      // Prompt MetaMask to re-confirm account access so user can choose a wallet.
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      if (error?.code === 4001) {
        throw new Error("MetaMask account selection was cancelled");
      }
      // Continue to eth_requestAccounts as fallback for wallets that don't support this method.
    }
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

let cachedConfig = null;

export async function getContractClients(signerOrProvider) {
  if (!cachedConfig) {
    cachedConfig = await getContractsConfig();
  }

  const escrow = new ethers.Contract(
    cachedConfig.addresses.EVChargingEscrow,
    cachedConfig.abis.escrow,
    signerOrProvider,
  );

  const registry = new ethers.Contract(
    cachedConfig.addresses.UserRegistry,
    cachedConfig.abis.registry,
    signerOrProvider,
  );

  return { escrow, registry, config: cachedConfig };
}

export async function ensureExpectedChain(config) {
  if (!window.ethereum) {
    return;
  }

  const expectedChainId = Number(
    config?.chainId || process.env.NEXT_PUBLIC_TARGET_CHAIN_ID || "11155111",
  );

  if (!Number.isFinite(expectedChainId) || expectedChainId <= 0) {
    return;
  }

  const currentHex = await window.ethereum.request({ method: "eth_chainId" });
  const current = Number.parseInt(currentHex, 16);
  if (current === expectedChainId) {
    return;
  }

  const targetHex = `0x${expectedChainId.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (error) {
    throw new Error(
      `Wrong wallet network. Switch MetaMask to chain ID ${expectedChainId} and retry.`,
    );
  }
}

export function readableContractError(error) {
  const raw = String(error?.shortMessage || error?.message || "Transaction failed");
  if (/not verified/i.test(raw)) {
    return "Wallet is not verified in Userregistry. Open Profile, register on-chain, then ask the registry admin to verify your address.";
  }
  if (/user already registerd|already register/i.test(raw)) {
    return "This wallet is already registered in Userregistry.";
  }
  return raw;
}

export async function ensureVerifiedUser(registry, address) {
  const verified = await registry.isvarifieduser(address);
  if (!verified) {
    throw new Error(
      "Wallet is not verified in Userregistry. Open Profile, register on-chain, then ask the registry admin to verify your address.",
    );
  }
}

export function formatAddress(address) {
  if (!address) {
    return "-";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatEthFromWei(wei) {
  try {
    return `${ethers.formatEther(BigInt(wei || 0))} ETH`;
  } catch {
    return String(wei || 0);
  }
}
