/**
 * SPIM Suite mobile API transport layer.
 *
 * Centralises Base URL resolution, bearer-token injection, JSON
 * encoding/decoding and 401 handling. All other services should go through
 * `apiFetch` (or its JSON helpers) rather than calling fetch() directly so
 * authentication and error handling stay consistent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/** AsyncStorage key used to persist the bearer token across launches. */
export const AUTH_TOKEN_KEY = 'mobile_auth_token';

/**
 * Resolve the API base URL.
 *
 * Order of precedence:
 *   1. expo-constants extra.apiBaseUrl (set in app.json)
 *   2. EXPO_PUBLIC_API_BASE_URL env var
 *   3. Production Railway deployment (fallback)
 */
const extra =
  (Constants.expoConfig?.extra as Record<string, string | undefined> | undefined) ??
  ((Constants.manifest as any)?.extra as Record<string, string | undefined> | undefined) ??
  {};

export const API_BASE_URL = (
  extra.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://spim-suite-production.up.railway.app'
).replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// 401 handler — provided by the auth store at app start so this transport
// layer can clear session state without importing the store directly
// (which would create a circular dependency: apiClient -> store -> apiClient).
// ---------------------------------------------------------------------------

let onUnauthorized: (() => void | Promise<void>) | null = null;

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  onUnauthorized = handler;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore — token is already effectively gone.
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Plain-object body — will be JSON-encoded. Use `rawBody` for non-JSON. */
  json?: unknown;
  /** Raw body (FormData, string, etc.) — sent as-is, content-type not set. */
  rawBody?: BodyInit;
  /** Skip injecting Authorization header (used by /login/). */
  skipAuth?: boolean;
  /**
   * Skip the 401 -> clear-token-and-redirect behaviour. Useful for endpoints
   * where a 401 is expected (e.g. token verification probes).
   */
  skipAuthRedirect?: boolean;
}

/**
 * Low-level wrapper. Returns the raw Response so callers can decide between
 * JSON parsing, blob, signed-url passthrough, etc.
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const {
    json,
    rawBody,
    skipAuth = false,
    skipAuthRedirect = false,
    headers,
    ...rest
  } = opts;

  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  let body: BodyInit | undefined;
  if (json !== undefined) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
    body = JSON.stringify(json);
  } else if (rawBody !== undefined) {
    body = rawBody;
  }

  if (!skipAuth) {
    const token = await getAuthToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...rest, headers: finalHeaders, body });

  if (res.status === 401 && !skipAuthRedirect && !skipAuth) {
    await clearAuthToken();
    if (onUnauthorized) {
      try { await onUnauthorized(); } catch { /* swallow */ }
    }
  }

  return res;
}

/** Parse JSON body if any; returns null on empty. Throws ApiError on !ok. */
async function parseJsonOrThrow(res: Response): Promise<any> {
  const text = await res.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const msg =
      (parsed && (parsed.error || parsed.detail || parsed.message)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status, parsed);
  }
  return parsed;
}

export async function apiGet<T = any>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { ...opts, method: 'GET' });
  return parseJsonOrThrow(res) as Promise<T>;
}

export async function apiPost<T = any>(
  path: string,
  json?: unknown,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(path, { ...opts, method: 'POST', json });
  return parseJsonOrThrow(res) as Promise<T>;
}

export async function apiPut<T = any>(
  path: string,
  json?: unknown,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(path, { ...opts, method: 'PUT', json });
  return parseJsonOrThrow(res) as Promise<T>;
}

export async function apiPatch<T = any>(
  path: string,
  json?: unknown,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(path, { ...opts, method: 'PATCH', json });
  return parseJsonOrThrow(res) as Promise<T>;
}

export async function apiDelete<T = any>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(path, { ...opts, method: 'DELETE' });
  return parseJsonOrThrow(res) as Promise<T>;
}
