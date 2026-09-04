import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { API_BASE_URL } from "./config";

const DEVICE_ID_KEY = "ojds_device_id";
const SESSION_KEY = "ojds_session_id";
const USER_KEY = "ojds_user";

export type CurrentUser = { id: string; name: string; role: "TEACHER" | "ADMIN"; title: string | null };

/**
 * Same role as the web login form's localStorage UUID: a value generated
 * once per install and sent on every login so a teacher's account can be
 * locked to a single device. Persisted in SecureStore (Keychain/Keystore)
 * rather than plain storage since it's a security-relevant identifier.
 */
export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

export type LoginOutcome =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "invalid" | "device_pending" | "network" };

export async function login(username: string, password: string): Promise<LoginOutcome> {
  const deviceId = await getDeviceId();

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, deviceId }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = body?.error === "device_pending" ? "device_pending" : "invalid";
    return { ok: false, reason };
  }

  await SecureStore.setItemAsync(SESSION_KEY, body.sessionId);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user));
  return { ok: true, user: body.user };
}

/**
 * Tells the server to actually delete this session (so a lost/reset phone
 * can't keep using the same bearer token after "signing out"), then
 * clears local storage regardless of whether that request succeeded -
 * the user shouldn't be stuck signed in locally just because the network
 * was briefly down.
 */
export async function logout() {
  const stored = await getStoredSession();
  if (stored) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stored.sessionId}` },
    }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

// A plain module-level pub/sub so code outside React (api.ts, which has
// no access to AuthContext's setUser) can tell the app "the session is
// gone" and have AuthContext react to it, instead of the UI being stuck
// showing screens for a user that's no longer actually signed in.
type Listener = () => void;
let sessionInvalidatedListeners: Listener[] = [];

export function onSessionInvalidated(listener: Listener) {
  sessionInvalidatedListeners.push(listener);
  return () => {
    sessionInvalidatedListeners = sessionInvalidatedListeners.filter((l) => l !== listener);
  };
}

/**
 * Clears local storage only, with no server call - for when the server
 * has already told us the session is gone (a 401 response), so there's
 * nothing left to ask it to delete. `logout()` is for the user actively
 * choosing to sign out; this is for the app discovering it already
 * happened (e.g. an admin unbound the device, or the session expired).
 */
export async function clearLocalSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  sessionInvalidatedListeners.forEach((l) => l());
}

export async function getStoredSession(): Promise<{ sessionId: string; user: CurrentUser } | null> {
  const [sessionId, userJson] = await Promise.all([
    SecureStore.getItemAsync(SESSION_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!sessionId || !userJson) return null;
  return { sessionId, user: JSON.parse(userJson) as CurrentUser };
}
