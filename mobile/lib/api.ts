import { API_BASE_URL } from "./config";
import { getStoredSession } from "./auth";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

/** Authenticated JSON fetch: attaches the stored session as a bearer token. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getStoredSession();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.sessionId}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, body?.error);
  }

  return body as T;
}
