import { blocksClient } from "./client";
import { blocksConfig } from "./config";
import { isJwtExpired } from "./jwt";

// IAM's hosted IdP flow sets the session as a Secure, httpOnly cookie by
// default -- this app never sees that token and must not try to. Bearer
// tokens below are only populated when a tenant's OIDC config explicitly
// opts into returning tokens in the response body instead of a cookie; in
// the default cookie flow every function below simply no-ops around them.
const TOKEN_KEY = "blocks-app:access-token";
const REFRESH_TOKEN_KEY = "blocks-app:refresh-token";
const RETURN_KEY = "blocks-app:oidc-return-to";

export type CallbackResult = { ok: true; returnTo: string } | { ok: false; message: string };

let cachedAccessToken: string | undefined;
let cachedRefreshToken: string | undefined;
let refreshInFlight: Promise<string | undefined> | undefined;

// AuthProvider subscribes to this to learn the session died out-of-band (a
// refresh came back invalid_grant) so it can flip status to unauthenticated
// and let RequireAuth redirect to /login -- this module has no router access
// of its own to do that navigation directly.
const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

function getAccessToken(): string | undefined {
  if (cachedAccessToken && !isJwtExpired(cachedAccessToken)) return cachedAccessToken;

  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (stored && !isJwtExpired(stored)) {
    cachedAccessToken = stored;
    return stored;
  }

  return undefined;
}

// Never written to storage by this app, deliberately: a refresh token is
// long-lived, and anything readable from JS is readable by an XSS payload.
// The access token is short-lived, so that one is persisted to keep a
// reload from bouncing the user, and IAM's httpOnly session cookie
// re-establishes the session once it expires.
//
// The stored value is still *read* as a fallback, for a host that can
// re-establish a session but cannot reach this module's variables -- a
// build running inside blocks-studio's preview is the case that matters:
// the session lives in an httpOnly cookie the page cannot see, and there
// is no reload-surviving cookie flow to fall back on, so the host seeds a
// non-secret marker here to say "ask for a refresh". Reading it is safe
// precisely because this app never puts a real token there.
function getRefreshToken(): string | undefined {
  if (cachedRefreshToken) return cachedRefreshToken;

  const seeded = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  return seeded ?? undefined;
}

function persistTokens(accessToken: string, refreshToken?: string): void {
  cachedAccessToken = accessToken;
  sessionStorage.setItem(TOKEN_KEY, accessToken);

  if (refreshToken) cachedRefreshToken = refreshToken;
}

function clearLocalTokens(): void {
  cachedAccessToken = undefined;
  cachedRefreshToken = undefined;
  sessionStorage.removeItem(TOKEN_KEY);
  // This app never writes that key, but a host may have seeded it (see
  // getRefreshToken) and an earlier build of this app may have persisted a
  // real token there -- either way it must not survive a sign-out.
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Passed to createBlocksClient as the `accessToken` resolver: returns the
// cached token when it's still fresh, otherwise refreshes it through
// blocksClient.auth.oidc.refreshToken() -- concurrent callers share one
// in-flight refresh instead of racing duplicate requests. Resolves to
// undefined in the default cookie flow (nothing cached, nothing to
// refresh); the SDK still sends the session cookie on every request, so
// protected calls keep working without an Authorization header.
export async function getValidAccessToken(): Promise<string | undefined> {
  const current = getAccessToken();
  if (current) return current;
  return forceRefreshAccessToken();
}

// Passed to createBlocksClient as `onUnauthorized`: unlike getValidAccessToken,
// this skips the "is the cached token still fresh" check and always goes
// straight to refreshAccessToken() -- a 401 means the server already
// disagreed with our local judgment of freshness, so re-checking it would
// just resend the same rejected token. Still funnels through the same
// refreshInFlight guard, so a burst of concurrent 401s (and any proactive
// caller racing them) share one refresh call instead of firing one each.
export async function forceRefreshAccessToken(): Promise<string | undefined> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return undefined;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(refreshToken).finally(() => {
      refreshInFlight = undefined;
    });
  }

  return refreshInFlight;
}

async function refreshAccessToken(refreshToken: string): Promise<string | undefined> {
  let response: Awaited<ReturnType<typeof blocksClient.auth.oidc.refreshToken>>;
  try {
    response = await blocksClient.auth.oidc.refreshToken({ refreshToken });
  } catch {
    // A network/transport failure here says nothing about whether the
    // refresh token itself is still valid -- keep it cached so the next
    // attempt can still use it, instead of forcing a fresh sign-in over a
    // transient blip (e.g. the dev server restarting mid-session).
    return undefined;
  }

  const accessToken = response.access_token ?? response.accessToken;
  if (!accessToken) {
    // IAM answered but explicitly rejected the grant (e.g. invalid_grant --
    // the refresh token expired or was already rotated away) -- now it
    // really is dead, so this is a full sign-out, not just a cache clear.
    // Clear local state before the logout call so its own accessToken
    // lookup finds nothing to refresh and doesn't loop back into us.
    clearLocalTokens();
    await blocksClient.auth.logout({ refreshToken }).catch(() => undefined);
    notifySessionExpired();
    return undefined;
  }

  // The identity provider may not rotate the refresh token on every call --
  // keep the previous one instead of overwriting a working token with undefined.
  const nextRefreshToken = response.refresh_token ?? response.refreshToken ?? refreshToken;
  persistTokens(accessToken, nextRefreshToken);
  return accessToken;
}

// The session's source of truth is IAM, not a token this app can inspect --
// `GET /iam/v4/auth/me` (blocksClient.auth.userInfo()) validates the
// httpOnly session cookie (or bearer token, if one is cached) and returns
// its claims in one round trip. `iam.me()` is a different, heavier call --
// the full IAM user profile with roles/permissions -- and is used
// separately on the Profile page; it is not a substitute for this check.
export async function fetchSessionClaims(): Promise<Record<string, unknown> | undefined> {
  try {
    const claims = await blocksClient.auth.userInfo();
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return undefined;
    if (iamErrorMessage(claims) || !Object.keys(claims).length) return undefined;
    return claims;
  } catch {
    return undefined;
  }
}

function iamErrorMessage(result: unknown): string | undefined {
  if (!result) return undefined;
  if (typeof result === "string") return result || undefined;
  if (typeof result !== "object") return undefined;

  const record = result as Record<string, unknown>;
  if (typeof record.error_description === "string" && record.error_description) return record.error_description;
  if (typeof record.error === "string" && record.error && record.error !== "success") return record.error;
  if (record.isSuccess === false && typeof record.message === "string" && record.message) return record.message;
  const errors = record.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((item) => {
        if (typeof item === "string") return item;
        const nested = item as { errorMessage?: string; message?: string };
        return nested.errorMessage || nested.message || "";
      })
      .filter(Boolean)
      .join("; ");
  }
  if (record.isSuccess === false) return "Request failed.";
  return undefined;
}

function applyAuthResponse(data: unknown): void {
  const message = iamErrorMessage(data);
  if (message) throw new Error(message);
  if (!data || typeof data !== "object") return;

  const record = data as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : undefined;
  const accessToken = (record.access_token ?? record.accessToken ?? nested?.access_token ?? nested?.accessToken) as string | undefined;
  const refreshToken = (record.refresh_token ?? record.refreshToken ?? nested?.refresh_token ?? nested?.refreshToken) as string | undefined;
  if (accessToken) persistTokens(accessToken, refreshToken);
}

async function hasSession(): Promise<boolean> {
  if (cachedAccessToken && !isJwtExpired(cachedAccessToken)) return true;
  return blocksClient.auth.isAuthenticated();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function loginWithPassword(username: string, password: string): Promise<void> {
  const data = await blocksClient.auth.login({ username, password });
  applyAuthResponse(data);
  if (await hasSession()) return;
  throw new Error("Sign-in failed. Check your email and password.");
}

export async function signupAccount(input: { email: string; firstName: string; lastName: string }): Promise<{ signedIn: boolean }> {
  const availability = await blocksClient.iam.users.emailAvailable({ email: input.email }).catch(() => undefined);
  if (availability && (availability.isAvailable === false || availability.IsAvailable === false)) {
    throw new Error("That email is already registered. Sign in instead.");
  }

  const result = await blocksClient.auth.signup({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    userName: input.email
  });
  applyAuthResponse(result);

  if (await hasSession()) return { signedIn: true };
  return { signedIn: false };
}

export type ActivationPreview = {
  email?: string;
  firstName?: string;
  lastName?: string;
  valid: boolean;
};

export async function validateActivationCode(code: string): Promise<ActivationPreview> {
  const data = await blocksClient.auth.validateActivation({ code });
  const message = iamErrorMessage(data);
  if (message) throw new Error(message);

  const record = asRecord(data);
  const nested = asRecord(record?.data);
  const source = nested ?? record;
  const validFlag = source?.valid ?? source?.isValid ?? record?.valid ?? record?.isValid;
  const valid = validFlag === undefined ? true : Boolean(validFlag);

  return {
    email: pickString(source, "email", "Email", "userName", "UserName"),
    firstName: pickString(source, "firstName", "FirstName"),
    lastName: pickString(source, "lastName", "LastName"),
    valid
  };
}

export async function activateAccount(input: {
  code: string;
  firstName?: string;
  lastName?: string;
  password: string;
}): Promise<void> {
  const result = await blocksClient.auth.activate({
    code: input.code,
    password: input.password,
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {})
  });
  applyAuthResponse(result);
}

export async function resendActivationEmail(email: string): Promise<void> {
  const result = await blocksClient.auth.resendActivation({ email });
  applyAuthResponse(result);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const result = await blocksClient.auth.recover({ email, userName: email });
  const message = iamErrorMessage(result);
  if (message) throw new Error(message);
}

export async function resetAccountPassword(input: { code: string; password: string }): Promise<void> {
  const result = await blocksClient.auth.resetPassword({
    code: input.code,
    password: input.password,
    token: input.code
  });
  const message = iamErrorMessage(result);
  if (message) throw new Error(message);
  applyAuthResponse(result);
}

export async function startLogin(returnTo?: string): Promise<void> {
  if (!blocksConfig.oidcClientId) {
    throw new Error("Login is not configured. Set VITE_BLOCKS_OIDC_CLIENT_ID in .env.");
  }

  sessionStorage.setItem(RETURN_KEY, returnTo || "/");
  await blocksClient.auth.idp.redirectToProvider();
}

export async function completeLogin(callbackUrl: string): Promise<CallbackResult> {
  const returnTo = sessionStorage.getItem(RETURN_KEY) || "/";

  sessionStorage.removeItem(RETURN_KEY);

  const data = await blocksClient.auth.idp.callback(callbackUrl);

  if (data.error) {
    return { message: data.error_description || data.error, ok: false };
  }

  // In the default cookie flow IAM sets the session via Set-Cookie on this
  // same response and returns no token in the body -- that's success, not
  // a failure. Only cache a token here if a non-default OIDC config made
  // IAM return one.
  const accessToken = data.access_token ?? data.accessToken;
  if (accessToken) persistTokens(accessToken, data.refresh_token ?? data.refreshToken);

  return { ok: true, returnTo };
}

export async function logout(): Promise<void> {
  // Ask IAM to end the session (clears the httpOnly cookie server-side)
  // before dropping any locally cached bearer token; best-effort so a
  // network failure never blocks the user from leaving a protected page.
  await blocksClient.auth.logout({ refreshToken: getRefreshToken() }).catch(() => undefined);
  clearLocalTokens();
}
