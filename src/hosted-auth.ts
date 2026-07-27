/** Production apex serving /hosted-auth (must match API free-tier allowed_origins). */
export const HOSTED_AUTH_SITE_ORIGIN = "https://auth.enclave.talk";

export const HOSTED_AUTH_PATH = "/hosted-auth";

/**
 * Origins where the hosted tenant UI runs — never redirect away from these
 * (prevents redirect loops on /hosted-auth).
 */
export const HOSTED_AUTH_SITE_ORIGINS = [
  HOSTED_AUTH_SITE_ORIGIN,
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
] as const;

export type EnclaveAuthEmbedMode = "sign-in" | "sign-up" | "account";

export function isHostedAuthSiteOrigin(origin: string): boolean {
  const normalized = origin.trim().toLowerCase();
  return HOSTED_AUTH_SITE_ORIGINS.some(
    (allowed) => allowed.toLowerCase() === normalized,
  );
}

export function isHostedAuthSiteLocation(
  location: Pick<Location, "origin" | "pathname">,
): boolean {
  if (!isHostedAuthSiteOrigin(location.origin)) {
    return false;
  }
  return location.pathname.replace(/\/+$/, "") === HOSTED_AUTH_PATH;
}

export function buildHostedAuthRedirectUrl(
  baseUrl: string,
  publishableKey: string,
  mode: EnclaveAuthEmbedMode,
  returnUrl?: string,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${HOSTED_AUTH_PATH}`);
  url.searchParams.set("pk", publishableKey);
  url.searchParams.set("mode", mode);
  if (returnUrl) {
    url.searchParams.set("return_url", returnUrl);
  }
  return url.toString();
}

export function redirectToHostedAuth(url: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}

export function currentReturnUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.href;
}
