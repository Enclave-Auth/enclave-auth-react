import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserProfile } from "../src/components/UserProfile.js";
import { sessionStorageKey } from "../src/session/storage.js";
import { renderWithAuth } from "./helpers/render.js";
import { jsonResponse, routePost, TEST_APP_ID } from "./helpers/mock-api.js";

const profileRoute = routePost("/auth-account-profile", () =>
  jsonResponse({ email: "user@example.com", pinEnrolled: false }),
);

vi.mock("@enclave-technologies/auth-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@enclave-technologies/auth-sdk")>();
  return {
    ...actual,
    initCrypto: vi.fn(async () => {}),
    deriveAmkWithPassword: vi.fn(),
    unlockWithPassword: vi.fn(async () => ({
      amk: new Uint8Array(32),
      identitySecretKeySeed: new Uint8Array(32),
    })),
    changePassword: vi.fn(async () => ({ formatVersion: 1, method: "password" })),
    validatePassword: vi.fn(async () => ({ valid: true })),
    validatePin: vi.fn(() => ({ valid: true })),
    setPinMethod: vi.fn(async () => ({
      verificationHash: { v: 1 },
      pinUnlock: { v: 1 },
    })),
    generateRecoveryKey: vi.fn(() => new Uint8Array(32)),
    getRecoveryKeyWords: vi.fn(() =>
      Array.from({ length: 24 }, (_, i) => `word${i + 1}`),
    ),
    registerRecoveryKeyMethod: vi.fn(async () => ({
      formatVersion: 1,
      method: "recovery-key",
      nonce: "n",
      ciphertext: "c",
    })),
    pickConfirmationIndices: vi.fn(() => [0, 5, 11]),
    checkConfirmationWords: vi.fn(
      (_words, indices, submitted) =>
        indices.every((i) => submitted[i]?.trim().length > 0),
    ),
    UnlockFailedError: actual.UnlockFailedError,
  };
});

import {
  UnlockFailedError,
  unlockWithPassword,
} from "@enclave-technologies/auth-sdk";

function signedInRender(extraRoutes: Parameters<typeof renderWithAuth>[1] = {}) {
  localStorage.setItem(
    sessionStorageKey(TEST_APP_ID),
    "sess_profile_test",
  );
  return renderWithAuth(<UserProfile />, {
    routes: [profileRoute, ...(extraRoutes?.routes ?? [])],
    ...extraRoutes,
  });
}

describe("UserProfile", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows sign-in prompt when not authenticated", async () => {
    renderWithAuth(<UserProfile />, { routes: [profileRoute] });
    await waitFor(() => {
      expect(screen.getByText(/sign in to manage/i)).toBeInTheDocument();
    });
  });

  it("loads account email from auth-account-profile", async () => {
    signedInRender();
    await waitFor(() => {
      expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
    });
  });

  it("change-password rejects wrong current password before new-password step", async () => {
    const user = userEvent.setup();
    vi.mocked(unlockWithPassword).mockRejectedValueOnce(
      new UnlockFailedError(),
    );

    signedInRender({
      routes: [
        profileRoute,
        routePost("/auth-account-blobs", () =>
          jsonResponse({
            wrappedIdentityKey: { formatVersion: 1, nonce: "n", ciphertext: "c" },
            passwordUnlock: {
              formatVersion: 1,
              method: "password",
              nonce: "n",
              ciphertext: "c",
              salt: "s",
              argon2Params: {
                memoryCostKib: 1,
                iterations: 1,
                parallelism: 1,
              },
            },
            recoveryUnlock: {
              formatVersion: 1,
              method: "recovery-key",
              nonce: "n",
              ciphertext: "c",
            },
          }),
        ),
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Change password" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Change password" }));
    await user.type(
      screen.getByLabelText(/current password/i),
      "wrong-password-12",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("shows PIN setup when pinEnrolled is false", async () => {
    signedInRender();
    await waitFor(() => {
      expect(screen.getByText(/no recovery pin enrolled/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Set up PIN" })).toBeInTheDocument();
  });

  it("shows rotate PIN when pinEnrolled is true", async () => {
    signedInRender({
      routes: [
        routePost("/auth-account-profile", () =>
          jsonResponse({ email: "user@example.com", pinEnrolled: true }),
        ),
      ],
    });
    await waitFor(() => {
      expect(
        screen.getByText(/recovery pin is enrolled/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Rotate PIN" })).toBeInTheDocument();
  });

  it("renders sessions coming-soon placeholder", async () => {
    signedInRender();
    await waitFor(() => {
      expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
      expect(screen.getByText(/enclave authenticator/i)).toBeInTheDocument();
    });
  });

  it("does not persist AMK material in localStorage", async () => {
    signedInRender();
    await waitFor(() => {
      expect(screen.getByDisplayValue("user@example.com")).toBeInTheDocument();
    });

    for (const key of Object.keys(localStorage)) {
      expect(key).not.toMatch(/amk/i);
      expect(localStorage.getItem(key)).not.toMatch(/identity/i);
    }
  });
});
