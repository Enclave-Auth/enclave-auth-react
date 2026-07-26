import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SignIn } from "../src/components/SignIn.js";
import { renderWithAuth } from "./helpers/render.js";
import { jsonResponse, routePost } from "./helpers/mock-api.js";

vi.mock("@enclave/auth-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@enclave/auth-sdk")>();
  return {
    ...actual,
    initCrypto: vi.fn(async () => {}),
    unlockWithPassword: vi.fn(async () => ({
      amk: new Uint8Array(32),
      identitySecretKeySeed: new Uint8Array(32),
    })),
    unlockWithRecoveryKey: vi.fn(async () => ({
      amk: new Uint8Array(32),
      identitySecretKeySeed: new Uint8Array(32),
    })),
    decodeRecoveryKeyFromDisplay: vi.fn(() => new Uint8Array(32)),
    signChallenge: vi.fn(async () => "sig_test"),
    validatePassword: vi.fn(async () => ({ valid: true })),
    UnlockFailedError: actual.UnlockFailedError,
  };
});

import {
  UnlockFailedError,
  unlockWithPassword,
} from "@enclave/auth-sdk";

describe("SignIn", () => {
  it("completes password sign-in flow", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    renderWithAuth(<SignIn onSuccess={onSuccess} />, {
      routes: [
        routePost("/auth-account-blobs", () =>
          jsonResponse({
            wrappedIdentityKey: { formatVersion: 1, nonce: "n", ciphertext: "c" },
            passwordUnlock: {
              formatVersion: 1,
              method: "password",
              nonce: "n",
              ciphertext: "c",
              salt: "s",
              argon2Params: { memoryCostKib: 1, iterations: 1, parallelism: 1 },
            },
            recoveryUnlock: {
              formatVersion: 1,
              method: "recovery-key",
              nonce: "n",
              ciphertext: "c",
            },
          }),
        ),
        routePost("/auth-login-challenge", () =>
          jsonResponse({
            challengeId: "ch_1",
            nonce: "nonce",
            context: "ctx",
            issuedAt: Date.now(),
          }),
        ),
        routePost("/auth-login-verify", () =>
          jsonResponse({ sessionToken: "sess_new" }),
        ),
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secure-password-12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows generic error on wrong password", async () => {
    const user = userEvent.setup();
    vi.mocked(unlockWithPassword).mockRejectedValueOnce(new UnlockFailedError());

    renderWithAuth(<SignIn />, {
      routes: [
        routePost("/auth-account-blobs", () =>
          jsonResponse({
            wrappedIdentityKey: { formatVersion: 1, nonce: "n", ciphertext: "c" },
            passwordUnlock: {
              formatVersion: 1,
              method: "password",
              nonce: "n",
              ciphertext: "c",
              salt: "s",
              argon2Params: { memoryCostKib: 1, iterations: 1, parallelism: 1 },
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
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrong-password-12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(
        screen.getByText(/incorrect email or password/i),
      ).toBeInTheDocument();
    });
  });

  it("handles rate limiting with retry-after", async () => {
    const user = userEvent.setup();

    renderWithAuth(<SignIn />, {
      routes: [
        routePost("/auth-account-blobs", () =>
          jsonResponse({ error: "Too many requests" }, 429, {
            "Retry-After": "3",
          }),
        ),
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secure-password-12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText(/try again in/i)).toBeInTheDocument();
    });
  });
});
