import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { EnclaveAuthProvider, useAuth } from "../src/context/EnclaveAuthProvider.js";
import {
  clearSessionToken,
  readSessionToken,
  sessionStorageKey,
  writeSessionToken,
} from "../src/session/storage.js";
import {
  TEST_API_BASE,
  TEST_APP_ID,
  TEST_PUBLISHABLE_KEY,
  createMockFetch,
  jsonResponse,
  routePost,
} from "./helpers/mock-api.js";

vi.mock("@enclave/auth-sdk", () => ({
  initCrypto: vi.fn(async () => {}),
}));

function AuthProbe() {
  const { isSignedIn, sessionToken, signOut } = useAuth();
  return (
    <div>
      <span data-testid="signed-in">{String(isSignedIn)}</span>
      <span data-testid="token">{sessionToken ?? ""}</span>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

describe("session storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses applicationId namespaced key", () => {
    expect(sessionStorageKey(TEST_APP_ID)).toBe(
      `__enclave_auth_${TEST_APP_ID}_session`,
    );
  });

  it("persists and clears session token", () => {
    writeSessionToken(TEST_APP_ID, "sess_abc");
    expect(readSessionToken(TEST_APP_ID)).toBe("sess_abc");
    clearSessionToken(TEST_APP_ID);
    expect(readSessionToken(TEST_APP_ID)).toBeNull();
  });
});

describe("EnclaveAuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores cached session after reload", async () => {
    writeSessionToken(TEST_APP_ID, "sess_cached");

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: TEST_APP_ID,
          brandingRemovable: false,
        }),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
      >
        <AuthProbe />
      </EnclaveAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("signed-in").textContent).toBe("true");
    });
    expect(screen.getByTestId("token").textContent).toBe("sess_cached");
  });

  it("clears session on signOut", async () => {
    writeSessionToken(TEST_APP_ID, "sess_cached");

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: TEST_APP_ID,
          brandingRemovable: false,
        }),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
      >
        <AuthProbe />
      </EnclaveAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("signed-in").textContent).toBe("true");
    });

    screen.getByRole("button", { name: "Sign out" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("signed-in").textContent).toBe("false");
    });
    expect(readSessionToken(TEST_APP_ID)).toBeNull();
  });
});
