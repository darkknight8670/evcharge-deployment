const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const CANDIDATE_BASES = [
  API_BASE,
  "",
  "http://localhost:4000",
  "http://127.0.0.1:4000",
].filter((item, index, array) => item !== undefined && array.indexOf(item) === index);

function normalizePath(path) {
  if (path.startsWith("/api/")) {
    return path.replace("/api/", "/backend-api/");
  }
  return path;
}

async function request(path, options = {}) {
  const candidates = [];

  for (const base of CANDIDATE_BASES) {
    if (base) {
      candidates.push(`${base}${path}`);
    } else {
      candidates.push(normalizePath(path));
    }
  }

  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });

      const rawText = await res.text();
      let payload = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = { rawText };
      }

      if (!res.ok) {
        const statusLabel = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
        const fallbackText = typeof payload.rawText === "string" ? payload.rawText.slice(0, 180) : "";
        throw new Error(payload.error || fallbackText || `Request failed (${statusLabel}): ${path}`);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError && /Failed to fetch|NetworkError/i.test(String(lastError.message))) {
    throw new Error("Cannot reach backend API. Start backend on port 4000 and refresh.");
  }

  throw lastError || new Error(`Request failed: ${path}`);
}

export async function getSummary() {
  return request("/api/summary");
}

export async function loginProfile(data) {
  return request("/api/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile(address) {
  return request(`/api/profile/${address}`);
}

export async function getDonorFeed() {
  return request("/api/donor/feed");
}

export async function getReceiverBroadcasts() {
  return request("/api/receiver/broadcasts");
}

export async function createReceiverBroadcast(data) {
  return request("/api/receiver/broadcast", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSession(id) {
  return request(`/api/session/${id}`);
}

export async function updateSessionProgress(id, soc) {
  return request(`/api/session/${id}/progress`, {
    method: "POST",
    body: JSON.stringify({ soc }),
  });
}

export async function startCharging(id) {
  return request(`/api/session/${id}/start`, {
    method: "POST",
  });
}

export async function stopCharging(id) {
  return request(`/api/session/${id}/stop`, {
    method: "POST",
  });
}

export async function getHistory(address) {
  return request(`/api/history/${address}`);
}

export async function getRequest(id) {
  return request(`/api/request/${id}`);
}

export async function getContractsConfig() {
  return request("/api/contracts");
}

export async function adminRegisterUser(data) {
  return request("/api/admin/register-user", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAdminTransactions(adminAddress, limit = 200) {
  const params = new URLSearchParams({ adminAddress, limit: String(limit) });
  return request(`/api/admin/transactions?${params.toString()}`);
}

export async function getAdminLogs(adminAddress) {
  const params = new URLSearchParams({ adminAddress });
  return request(`/api/admin/logs?${params.toString()}`);
}

export { API_BASE };
