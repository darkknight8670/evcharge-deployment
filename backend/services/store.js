const fs = require("fs");
const path = require("path");

const statePath = path.join(__dirname, "..", "data", "state.json");

const sessions = new Map();
const broadcasts = new Map();
const profiles = new Map();
const requestProgress = new Map();

function loadState() {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const data = JSON.parse(raw);

    for (const [key, value] of Object.entries(data.sessions || {})) {
      sessions.set(key, value);
    }
    for (const [key, value] of Object.entries(data.broadcasts || {})) {
      broadcasts.set(key, value);
    }
    for (const [key, value] of Object.entries(data.profiles || {})) {
      profiles.set(key, value);
    }
    for (const [key, value] of Object.entries(data.requestProgress || {})) {
      requestProgress.set(String(key), value);
    }
  } catch {
    // First run or invalid file; start with empty in-memory store.
  }
}

function persistState() {
  const payload = {
    sessions: Object.fromEntries(sessions.entries()),
    broadcasts: Object.fromEntries(broadcasts.entries()),
    profiles: Object.fromEntries(profiles.entries()),
    requestProgress: Object.fromEntries(requestProgress.entries()),
  };

  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2));
}

loadState();

function getSession(address) {
  return sessions.get(address.toLowerCase()) || null;
}

function listSessions() {
  return Array.from(sessions.values()).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function setSession(address, payload) {
  sessions.set(address.toLowerCase(), {
    ...payload,
    updatedAt: Date.now(),
  });
  persistState();
}

function setProfile(address, payload) {
  profiles.set(address.toLowerCase(), {
    ...payload,
    updatedAt: Date.now(),
  });
  persistState();
}

function getProfile(address) {
  return profiles.get(address.toLowerCase()) || null;
}

function listProfiles() {
  return Array.from(profiles.values()).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function saveBroadcast(payload) {
  broadcasts.set(payload.id, {
    ...payload,
    updatedAt: Date.now(),
  });
  persistState();
}

function getBroadcast(id) {
  return broadcasts.get(id) || null;
}

function listBroadcasts() {
  return Array.from(broadcasts.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function setRequestProgress(id, payload) {
  const key = String(id);
  const previous = requestProgress.get(key) || {};

  requestProgress.set(key, {
    ...previous,
    ...payload,
    updatedAt: Date.now(),
  });

  persistState();
}

function getRequestProgress(id) {
  return requestProgress.get(String(id)) || null;
}

function listRequestProgress() {
  return Array.from(requestProgress.entries())
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

module.exports = {
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
};
