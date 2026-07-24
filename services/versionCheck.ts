/**
 * Startup version verification.
 *
 * Runs a single lightweight probe through the shared apiClient before the
 * root layout mounts any navigation. The probe reuses the existing
 * `App-Version` header (stamped by apiFetch) and the existing HTTP 426
 * handler (installed by store/updateStore.ts) — no duplicate version-check
 * logic and no new backend endpoint.
 *
 * The endpoint chosen is `/api/mobile/profile/`, an existing route:
 *   - It is the cheapest existing GET on the mobile API surface.
 *   - Any response (200 / 401 / 5xx / network error) is intentionally
 *     ignored: the ONLY signal this probe cares about is HTTP 426. If the
 *     backend returns 426, apiFetch's shared handler has already latched
 *     `updateRequired = true` in the store by the time this function
 *     resolves — no further action is needed here.
 *   - `skipAuth: true` lets the probe run on a cold-start install with no
 *     token in storage (the fresh-install case).
 *   - `skipAuthRedirect: true` suppresses the 401-logout side effect so an
 *     expected 401 (unauth request) does not clear a real session that a
 *     later `restoreSession()` call would otherwise validate.
 *   - `timeoutMs` caps the wait so a slow or unreachable backend cannot
 *     stall the whole app on launch. Timeouts and other network errors
 *     are swallowed — we fail OPEN on transport errors and continue with
 *     normal startup; a supported client should not be blocked from
 *     working just because the backend is briefly unreachable.
 */
import { apiFetch } from './apiClient';

const STARTUP_PROBE_PATH = '/api/mobile/profile/';
const STARTUP_PROBE_TIMEOUT_MS = 8000;

export async function verifyAppVersion(): Promise<void> {
  try {
    await apiFetch(STARTUP_PROBE_PATH, {
      method: 'GET',
      skipAuth: true,
      skipAuthRedirect: true,
      timeoutMs: STARTUP_PROBE_TIMEOUT_MS,
    });
  } catch {
    // Transport-level failure (timeout / offline / DNS). Fail open — a
    // real 426 would have been surfaced inside apiFetch BEFORE any error
    // could throw, so reaching this catch means the version signal was
    // never delivered and the app should continue normal startup.
  }
}
