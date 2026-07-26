/** localStorage key for the cached session token (per Application). */
export function sessionStorageKey(applicationId: string): string {
  return `__enclave_auth_${applicationId}_session`;
}

export function readSessionToken(applicationId: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(sessionStorageKey(applicationId));
  } catch {
    return null;
  }
}

export function writeSessionToken(
  applicationId: string,
  sessionToken: string,
): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(sessionStorageKey(applicationId), sessionToken);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function clearSessionToken(applicationId: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(sessionStorageKey(applicationId));
  } catch {
    /* ignore */
  }
}
