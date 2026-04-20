const KEY = "evcharge-session";

export function saveSession(payload) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(KEY);
}
