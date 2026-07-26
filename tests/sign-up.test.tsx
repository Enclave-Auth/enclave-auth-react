import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SignUp } from "../src/components/SignUp.js";
import { renderWithAuth } from "./helpers/render.js";
import { jsonResponse, routePost } from "./helpers/mock-api.js";

vi.mock("@enclave/auth-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@enclave/auth-sdk")>();
  return {
    ...actual,
    initCrypto: vi.fn(async () => {}),
    createAccount: vi.fn(async () => ({
      amk: new Uint8Array(32),
      identityPublicKey: new Uint8Array(2592),
      identitySecretKeySeed: new Uint8Array(32),
      wrappedIdentityKey: { formatVersion: 1, nonce: "n", ciphertext: "c" },
      passwordUnlock: { formatVersion: 1, method: "password", nonce: "n", ciphertext: "c", salt: "s", argon2Params: { memoryCostKib: 1, iterations: 1, parallelism: 1 } },
      recoveryKey: new Uint8Array(32),
      recoveryKeyDisplay: "word ".repeat(24).trim(),
      recoveryUnlock: { formatVersion: 1, method: "recovery-key", nonce: "n", ciphertext: "c" },
    })),
    getRecoveryKeyWords: vi.fn(() =>
      Array.from({ length: 24 }, (_, i) => `word${i + 1}`),
    ),
    pickConfirmationIndices: vi.fn(() => [0, 5, 11]),
    checkConfirmationWords: vi.fn(
      (_words, indices, submitted) =>
        indices.every((i) => submitted[i]?.trim().length > 0),
    ),
    validatePassword: vi.fn(async () => ({ valid: true })),
    validatePin: vi.fn(() => ({ valid: true })),
    signChallenge: vi.fn(async () => "sig_test"),
    setPinMethod: vi.fn(async () => ({
      verificationHash: { v: 1 },
      pinUnlock: { v: 1 },
    })),
    isPairwiseConsistencyFailure: vi.fn(() => false),
  };
});

describe("SignUp", () => {
  it("walks email verification through password step", async () => {
    const user = userEvent.setup();

    renderWithAuth(<SignUp />, {
      routes: [
        routePost("/auth-request-email-verification", () =>
          jsonResponse({ ok: true }),
        ),
        routePost("/auth-verify-email-code", () =>
          jsonResponse({ verificationToken: "vtok" }),
        ),
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });
  });

  it("shows error on wrong verification code", async () => {
    const user = userEvent.setup();

    renderWithAuth(<SignUp />, {
      routes: [
        routePost("/auth-request-email-verification", () =>
          jsonResponse({ ok: true }),
        ),
        routePost("/auth-verify-email-code", () =>
          jsonResponse({ error: "Invalid" }, 400),
        ),
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/verification code/i), "000000");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect code/i)).toBeInTheDocument();
    });
  });

  it("handles rate-limited verification resend", async () => {
    const user = userEvent.setup();

    renderWithAuth(<SignUp />, {
      routes: [
        routePost("/auth-request-email-verification", () =>
          jsonResponse({ ok: true }),
        ),
        routePost("/auth-verify-email-code", () =>
          jsonResponse({ verificationToken: "vtok" }),
        ),
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });
  });
});
