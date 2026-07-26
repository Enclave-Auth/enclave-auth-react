import {
  changePassword,
  encodePublicKey,
  signChallenge,
  unlockWithPassword,
  unlockWithPin,
  unlockWithRecoveryKey,
  type Challenge,
  type WrappedAmk,
  type WrappedIdentityKey,
} from "@enclave/auth-sdk";

import type { AuthApiClient } from "../api/client.js";
import type { AccountBlobsResponse } from "../api/types.js";

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("email is invalid");
  }
  return normalized;
}

export async function mintSessionFromIdentitySeed(
  api: AuthApiClient,
  email: string,
  identitySecretKeySeed: Uint8Array,
): Promise<string> {
  const challengeRes = await api.requestLoginChallenge(email);
  const challenge: Challenge = {
    nonce: challengeRes.nonce,
    issuedAt: challengeRes.issuedAt,
    context: challengeRes.context,
  };
  const signature = await signChallenge(identitySecretKeySeed, challenge);
  const verified = await api.verifyLogin(challengeRes.challengeId, signature);
  return verified.sessionToken;
}

export async function signInWithPassword(
  api: AuthApiClient,
  email: string,
  password: string,
  blobs?: AccountBlobsResponse,
): Promise<string> {
  const normalized = normalizeEmail(email);
  const accountBlobs = blobs ?? (await api.fetchAccountBlobs(normalized));
  const unlocked = await unlockWithPassword(
    accountBlobs.wrappedIdentityKey as WrappedIdentityKey,
    accountBlobs.passwordUnlock as WrappedAmk,
    password,
  );
  try {
    return await mintSessionFromIdentitySeed(
      api,
      normalized,
      unlocked.identitySecretKeySeed,
    );
  } finally {
    unlocked.amk.fill(0);
    unlocked.identitySecretKeySeed.fill(0);
  }
}

export async function signInWithRecoveryKey(
  api: AuthApiClient,
  email: string,
  recoveryKey: Uint8Array,
  blobs?: AccountBlobsResponse,
): Promise<string> {
  const normalized = normalizeEmail(email);
  const accountBlobs = blobs ?? (await api.fetchAccountBlobs(normalized));
  const unlocked = await unlockWithRecoveryKey(
    accountBlobs.wrappedIdentityKey as WrappedIdentityKey,
    accountBlobs.recoveryUnlock as WrappedAmk,
    recoveryKey,
  );
  try {
    return await mintSessionFromIdentitySeed(
      api,
      normalized,
      unlocked.identitySecretKeySeed,
    );
  } finally {
    unlocked.amk.fill(0);
    unlocked.identitySecretKeySeed.fill(0);
  }
}

export async function resetPasswordWithPin(
  api: AuthApiClient,
  email: string,
  pin: string,
  newPassword: string,
): Promise<string> {
  const normalized = normalizeEmail(email);
  const res = await api.forgotPassword(normalized, pin);
  const unlocked = await unlockWithPin(
    res.wrappedIdentityKey as WrappedIdentityKey,
    res.pinUnlock as WrappedAmk,
    pin,
  );
  try {
    const newPasswordUnlock = await changePassword(unlocked.amk, newPassword);
    const challengeRes = await api.requestLoginChallenge(normalized);
    const challenge: Challenge = {
      nonce: challengeRes.nonce,
      issuedAt: challengeRes.issuedAt,
      context: challengeRes.context,
    };
    const signature = await signChallenge(
      unlocked.identitySecretKeySeed,
      challenge,
    );
    const authRes = await api.authorizePasswordChange({
      challengeId: challengeRes.challengeId,
      signature,
      newPasswordUnlock,
    });
    return authRes.sessionToken;
  } finally {
    unlocked.amk.fill(0);
    unlocked.identitySecretKeySeed.fill(0);
  }
}

export async function deriveAmkWithPassword(
  api: AuthApiClient,
  email: string,
  password: string,
): Promise<Uint8Array> {
  const normalized = normalizeEmail(email);
  const blobs = await api.fetchAccountBlobs(normalized);
  const unlocked = await unlockWithPassword(
    blobs.wrappedIdentityKey as WrappedIdentityKey,
    blobs.passwordUnlock as WrappedAmk,
    password,
  );
  unlocked.identitySecretKeySeed.fill(0);
  return unlocked.amk;
}

export function wipeAmk(amk: Uint8Array): void {
  amk.fill(0);
}

export async function withDerivedAmk<T>(
  api: AuthApiClient,
  email: string,
  password: string,
  action: (amk: Uint8Array) => Promise<T>,
): Promise<T> {
  const amk = await deriveAmkWithPassword(api, email, password);
  try {
    return await action(amk);
  } finally {
    wipeAmk(amk);
  }
}

export { encodePublicKey };
