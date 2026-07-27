import { useCallback, useEffect, useState } from "react";
import {
  UnlockFailedError,
  changePassword,
  checkConfirmationWords,
  generateRecoveryKey,
  getRecoveryKeyWords,
  pickConfirmationIndices,
  registerRecoveryKeyMethod,
  setPinMethod,
  validatePassword,
  validatePin,
  type PasswordValidationResult,
  type PinValidationResult,
} from "@enclave-technologies/auth-sdk";

import { AuthApiError } from "../api/client.js";
import type { AccountProfile } from "../api/types.js";
import { withDerivedAmk, deriveAmkWithPassword } from "../crypto/flows.js";
import { useEnclaveAuthContext } from "../context/EnclaveAuthProvider.js";
import type { EnclaveAuthAppearance } from "../context/types.js";
import { BrandedAuthPanel } from "./BrandedAuthPanel.js";
import { PoweredByFooter } from "./PoweredByFooter.js";
import {
  RecoveryKeyConfirmStep,
  RecoveryKeyDisplayStep,
} from "./RecoveryKeyPanel.js";
import {
  Button,
  ErrorText,
  Field,
  Muted,
  RetryAfterMessage,
  TextLink,
} from "./ui.js";

const GENERIC_PASSWORD_FAIL = "Incorrect password.";

export type UserProfileProps = {
  title?: string;
  appearance?: EnclaveAuthAppearance;
};

type PasswordFlow = "idle" | "verify" | "new" | "done";
type PinFlow = "idle" | "verify" | "new" | "done";
type RecoveryFlow = "idle" | "verify" | "display" | "confirm" | "done";

export function UserProfile({
  title = "Account",
  appearance,
}: UserProfileProps) {
  const { api, sessionToken, isSignedIn, signOut } = useEnclaveAuthContext();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordCheck, setPasswordCheck] =
    useState<PasswordValidationResult | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [pinFlow, setPinFlow] = useState<PinFlow>("idle");
  const [pinPassword, setPinPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinCheck, setPinCheck] = useState<PinValidationResult | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  const [recoveryFlow, setRecoveryFlow] = useState<RecoveryFlow>("idle");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryWords, setRecoveryWords] = useState<string[]>([]);
  const [recoveryKeyBytes, setRecoveryKeyBytes] = useState<Uint8Array | null>(
    null,
  );
  const [pendingAmk, setPendingAmk] = useState<Uint8Array | null>(null);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>(
    {},
  );
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const loadProfile = useCallback(async () => {
    if (!sessionToken) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await api.fetchAccountProfile(sessionToken);
      setProfile(data);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Could not load profile",
      );
    } finally {
      setProfileLoading(false);
    }
  }, [api, sessionToken]);

  useEffect(() => {
    if (isSignedIn && sessionToken) {
      void loadProfile();
    } else {
      setProfile(null);
    }
  }, [isSignedIn, sessionToken, loadProfile]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!newPassword) {
        setPasswordCheck(null);
        return;
      }
      const result = await validatePassword(newPassword);
      if (!cancelled) setPasswordCheck(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [newPassword]);

  useEffect(() => {
    if (!newPin) {
      setPinCheck(null);
      return;
    }
    setPinCheck(validatePin(newPin));
  }, [newPin]);

  useEffect(() => {
    return () => {
      if (recoveryKeyBytes) recoveryKeyBytes.fill(0);
      if (pendingAmk) pendingAmk.fill(0);
    };
  }, [recoveryKeyBytes, pendingAmk]);

  function wipeRecoverySecrets(): void {
    if (recoveryKeyBytes) recoveryKeyBytes.fill(0);
    if (pendingAmk) pendingAmk.fill(0);
    setRecoveryKeyBytes(null);
    setPendingAmk(null);
  }

  function handleApiError(err: unknown, fallback: string, setErr: (m: string | null) => void) {
    if (err instanceof AuthApiError && err.status === 429) {
      setRetryAfter(err.retryAfterSeconds ?? 60);
      setErr(null);
      return;
    }
    if (err instanceof UnlockFailedError) {
      setErr(GENERIC_PASSWORD_FAIL);
      return;
    }
    setErr(err instanceof Error ? err.message : fallback);
  }

  async function onVerifyCurrentPassword() {
    if (!profile || !sessionToken) return;
    setPasswordError(null);
    setRetryAfter(null);
    setPasswordBusy(true);
    try {
      await withDerivedAmk(api, profile.email, currentPassword, async () => {
        /* AMK derivable — advance to new-password step */
      });
      setPasswordFlow("new");
    } catch (err) {
      handleApiError(err, GENERIC_PASSWORD_FAIL, setPasswordError);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onSubmitNewPassword() {
    if (!profile || !sessionToken) return;
    setPasswordError(null);
    setRetryAfter(null);
    setPasswordBusy(true);
    try {
      const pw = await validatePassword(newPassword);
      if (!pw.valid) {
        setPasswordError("New password does not meet policy.");
        return;
      }
      await withDerivedAmk(api, profile.email, currentPassword, async (amk) => {
        const newPasswordUnlock = await changePassword(amk, newPassword);
        await api.changePasswordRemote(newPasswordUnlock, sessionToken);
      });
      setPasswordFlow("done");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      handleApiError(err, "Password change failed.", setPasswordError);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onVerifyPinPassword() {
    if (!profile) return;
    setPinError(null);
    setRetryAfter(null);
    setPinBusy(true);
    try {
      await withDerivedAmk(api, profile.email, pinPassword, async () => {});
      setPinFlow("new");
    } catch (err) {
      handleApiError(err, GENERIC_PASSWORD_FAIL, setPinError);
    } finally {
      setPinBusy(false);
    }
  }

  async function onSubmitPin() {
    if (!profile || !sessionToken) return;
    setPinError(null);
    setPinSuccess(null);
    setRetryAfter(null);
    setPinBusy(true);
    try {
      const pv = validatePin(newPin);
      if (!pv.valid) {
        setPinError(
          pv.reason === "too_short"
            ? "PIN must be at least 8 characters."
            : "Choose a stronger PIN.",
        );
        return;
      }
      await withDerivedAmk(api, profile.email, pinPassword, async (amk) => {
        const enrolled = await setPinMethod(amk, newPin);
        await api.enrollPin(
          {
            verificationHash: enrolled.verificationHash,
            pinUnlock: enrolled.pinUnlock,
          },
          sessionToken,
        );
      });
      setPinFlow("done");
      setPinPassword("");
      setNewPin("");
      setPinSuccess(
        profile.pinEnrolled ? "PIN rotated." : "PIN enrolled.",
      );
      await loadProfile();
    } catch (err) {
      handleApiError(err, "PIN update failed.", setPinError);
    } finally {
      setPinBusy(false);
    }
  }

  async function onVerifyRecoveryPassword() {
    if (!profile) return;
    setRecoveryError(null);
    setRetryAfter(null);
    setRecoveryBusy(true);
    try {
      const amk = await deriveAmkWithPassword(
        api,
        profile.email,
        recoveryPassword,
      );
      const keyBytes = generateRecoveryKey();
      setPendingAmk(amk);
      setRecoveryKeyBytes(keyBytes);
      setRecoveryWords(getRecoveryKeyWords(keyBytes));
      setConfirmIndices(pickConfirmationIndices(3));
      setConfirmInputs({});
      setRecoveryFlow("display");
    } catch (err) {
      handleApiError(err, GENERIC_PASSWORD_FAIL, setRecoveryError);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function onConfirmRecoveryKey() {
    if (!sessionToken || !pendingAmk || !recoveryKeyBytes) return;
    const ok = checkConfirmationWords(
      recoveryWords,
      confirmIndices,
      confirmInputs,
    );
    if (!ok) {
      setRecoveryError("Those words don't match. Try again.");
      return;
    }
    setRecoveryError(null);
    setRecoveryBusy(true);
    try {
      const recoveryUnlock = await registerRecoveryKeyMethod(
        pendingAmk,
        recoveryKeyBytes,
      );
      await api.rotateRecoveryKey(recoveryUnlock, sessionToken);
      wipeRecoverySecrets();
      setRecoveryFlow("done");
      setRecoveryPassword("");
      setRecoverySuccess(
        "Recovery Key regenerated. Your old key no longer works.",
      );
    } catch (err) {
      handleApiError(err, "Recovery Key rotation failed.", setRecoveryError);
    } finally {
      setRecoveryBusy(false);
    }
  }

  function copyRecoveryWords() {
    if (!recoveryWords.length) return;
    void navigator.clipboard.writeText(recoveryWords.join(" ")).catch(() => {});
  }

  if (!isSignedIn || !sessionToken) {
    return (
      <BrandedAuthPanel title={title} footer={<PoweredByFooter appearance={appearance} />}>
        <Muted>Sign in to manage your account.</Muted>
      </BrandedAuthPanel>
    );
  }

  return (
    <BrandedAuthPanel title={title} footer={<PoweredByFooter appearance={appearance} />}>
      {retryAfter != null ? (
        <RetryAfterMessage
          seconds={retryAfter}
          onDone={() => setRetryAfter(null)}
        />
      ) : null}

      <section className="enclave-auth__section">
        <h3 className="enclave-auth__section-title">Account info</h3>
        {profileLoading ? <Muted>Loading…</Muted> : null}
        {profileError ? <ErrorText>{profileError}</ErrorText> : null}
        {profile ? (
          <Field
            label="Email"
            value={profile.email}
            readOnly
            aria-readonly
          />
        ) : null}
      </section>

      <section className="enclave-auth__section">
        <h3 className="enclave-auth__section-title">Change password</h3>
        {passwordFlow === "idle" ? (
          <TextLink
            label="Change password"
            onClick={() => {
              setPasswordFlow("verify");
              setPasswordError(null);
            }}
          />
        ) : null}
        {passwordFlow === "verify" ? (
          <>
            <Muted>Enter your current password to continue.</Muted>
            <Field
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            {passwordError ? <ErrorText>{passwordError}</ErrorText> : null}
            <Button
              label={passwordBusy ? "Verifying…" : "Continue"}
              onClick={() => void onVerifyCurrentPassword()}
              disabled={
                passwordBusy || !currentPassword || retryAfter != null
              }
            />
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => {
                setPasswordFlow("idle");
                setCurrentPassword("");
                setPasswordError(null);
              }}
            />
          </>
        ) : null}
        {passwordFlow === "new" ? (
          <>
            <Field
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            {newPassword && passwordCheck && !passwordCheck.valid ? (
              <ErrorText>
                {passwordCheck.reason === "breached"
                  ? "Found in known breach lists — choose another."
                  : passwordCheck.reason === "too_short"
                    ? "At least 12 characters required."
                    : "Password rejected."}
              </ErrorText>
            ) : null}
            {passwordError ? <ErrorText>{passwordError}</ErrorText> : null}
            <Button
              label={passwordBusy ? "Saving…" : "Save new password"}
              onClick={() => void onSubmitNewPassword()}
              disabled={
                passwordBusy ||
                passwordCheck?.valid !== true ||
                retryAfter != null
              }
            />
          </>
        ) : null}
        {passwordFlow === "done" ? (
          <Muted>Password updated.</Muted>
        ) : null}
      </section>

      <section className="enclave-auth__section">
        <h3 className="enclave-auth__section-title">PIN management</h3>
        {profile ? (
          <Muted>
            {profile.pinEnrolled
              ? "A recovery PIN is enrolled on this account."
              : "No recovery PIN enrolled yet."}
          </Muted>
        ) : null}
        {pinSuccess ? <Muted>{pinSuccess}</Muted> : null}
        {pinFlow === "idle" ? (
          <TextLink
            label={profile?.pinEnrolled ? "Rotate PIN" : "Set up PIN"}
            onClick={() => {
              setPinFlow("verify");
              setPinError(null);
              setPinSuccess(null);
            }}
          />
        ) : null}
        {pinFlow === "verify" ? (
          <>
            <Muted>Confirm your password to {profile?.pinEnrolled ? "rotate" : "set up"} your PIN.</Muted>
            <Field
              label="Current password"
              type="password"
              value={pinPassword}
              onChange={(e) => setPinPassword(e.target.value)}
              autoComplete="current-password"
            />
            {pinError ? <ErrorText>{pinError}</ErrorText> : null}
            <Button
              label={pinBusy ? "Verifying…" : "Continue"}
              onClick={() => void onVerifyPinPassword()}
              disabled={pinBusy || !pinPassword || retryAfter != null}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => {
                setPinFlow("idle");
                setPinPassword("");
                setPinError(null);
              }}
            />
          </>
        ) : null}
        {pinFlow === "new" ? (
          <>
            <Field
              label={profile?.pinEnrolled ? "New PIN" : "PIN"}
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              autoComplete="off"
            />
            {newPin && pinCheck && !pinCheck.valid ? (
              <ErrorText>
                {pinCheck.reason === "too_short"
                  ? "PIN must be at least 8 characters."
                  : "PIN is too predictable."}
              </ErrorText>
            ) : null}
            {pinError ? <ErrorText>{pinError}</ErrorText> : null}
            <Button
              label={pinBusy ? "Saving…" : profile?.pinEnrolled ? "Rotate PIN" : "Enable PIN"}
              onClick={() => void onSubmitPin()}
              disabled={pinBusy || pinCheck?.valid !== true || retryAfter != null}
            />
          </>
        ) : null}
      </section>

      <section className="enclave-auth__section">
        <h3 className="enclave-auth__section-title">Recovery Key</h3>
        <Muted>
          Your Recovery Key cannot be viewed again — only regenerated. The
          previous key stops working once rotation completes.
        </Muted>
        {recoverySuccess ? <Muted>{recoverySuccess}</Muted> : null}
        {recoveryFlow === "idle" ? (
          <TextLink
            label="Regenerate Recovery Key"
            onClick={() => {
              setRecoveryFlow("verify");
              setRecoveryError(null);
              setRecoverySuccess(null);
            }}
          />
        ) : null}
        {recoveryFlow === "verify" ? (
          <>
            <Muted>Enter your password to generate a new Recovery Key.</Muted>
            <Field
              label="Current password"
              type="password"
              value={recoveryPassword}
              onChange={(e) => setRecoveryPassword(e.target.value)}
              autoComplete="current-password"
            />
            {recoveryError ? <ErrorText>{recoveryError}</ErrorText> : null}
            <Button
              label={recoveryBusy ? "Working…" : "Continue"}
              onClick={() => void onVerifyRecoveryPassword()}
              disabled={
                recoveryBusy || !recoveryPassword || retryAfter != null
              }
            />
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => {
                setRecoveryFlow("idle");
                setRecoveryPassword("");
                setRecoveryError(null);
                wipeRecoverySecrets();
              }}
            />
          </>
        ) : null}
        {recoveryFlow === "display" ? (
          <RecoveryKeyDisplayStep
            words={recoveryWords}
            error={recoveryError}
            onCopy={copyRecoveryWords}
            onContinue={() => {
              setConfirmIndices(pickConfirmationIndices(3));
              setConfirmInputs({});
              setRecoveryError(null);
              setRecoveryFlow("confirm");
            }}
          />
        ) : null}
        {recoveryFlow === "confirm" ? (
          <RecoveryKeyConfirmStep
            confirmIndices={confirmIndices}
            confirmInputs={confirmInputs}
            onInputChange={(idx, value) =>
              setConfirmInputs((prev) => ({ ...prev, [idx]: value }))
            }
            error={recoveryError}
            busy={recoveryBusy}
            onConfirm={() => void onConfirmRecoveryKey()}
            onShowAgain={() => {
              setRecoveryFlow("display");
              setRecoveryError(null);
            }}
          />
        ) : null}
      </section>

      <section className="enclave-auth__section">
        <h3 className="enclave-auth__section-title">Sessions & devices</h3>
        <div className="enclave-auth__coming-soon">
          <p className="enclave-auth__coming-soon-title">Coming soon</p>
          <p className="enclave-auth__coming-soon-body">
            Multi-device session management is planned for Enclave Authenticator
            — not available in embedded Auth yet.
          </p>
        </div>
      </section>

      <section className="enclave-auth__section">
        <Button label="Sign out" variant="ghost" onClick={signOut} />
      </section>
    </BrandedAuthPanel>
  );
}
