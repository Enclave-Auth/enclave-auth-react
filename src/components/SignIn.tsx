import { useEffect, useState } from "react";
import {
  UnlockFailedError,
  decodeRecoveryKeyFromDisplay,
  validatePassword,
  type PasswordValidationResult,
} from "@enclave/auth-sdk";

import { AuthApiError } from "../api/client.js";
import {
  normalizeEmail,
  resetPasswordWithPin,
  signInWithPassword,
  signInWithRecoveryKey,
} from "../crypto/flows.js";
import { useEnclaveAuthContext } from "../context/EnclaveAuthProvider.js";
import type { EnclaveAuthAppearance } from "../context/types.js";
import { BrandedAuthPanel } from "./BrandedAuthPanel.js";
import { PoweredByFooter } from "./PoweredByFooter.js";
import {
  Button,
  ErrorText,
  Field,
  Muted,
  RetryAfterMessage,
  TextLink,
  WarningBanner,
} from "./ui.js";

type SignInMode = "password" | "recovery-key" | "forgot-password";

const GENERIC_FAIL = "Incorrect email or password.";

export type SignInProps = {
  title?: string;
  subtitle?: string;
  appearance?: EnclaveAuthAppearance;
  onSuccess?: () => void;
};

export function SignIn({
  title = "Sign in",
  subtitle = "Welcome back. Sign in with your email and password.",
  appearance,
  onSuccess,
}: SignInProps) {
  const { api, setSession, refreshApplicationConfig } = useEnclaveAuthContext();
  const [mode, setMode] = useState<SignInMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordCheck, setPasswordCheck] =
    useState<PasswordValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

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

  function handleApiError(err: unknown, fallback: string) {
    if (err instanceof AuthApiError && err.status === 429) {
      setRetryAfter(err.retryAfterSeconds ?? 60);
      setError(null);
      return;
    }
    if (err instanceof UnlockFailedError) {
      setError(GENERIC_FAIL);
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }

  async function finishSignIn(token: string) {
    setSession(token);
    onSuccess?.();
  }

  async function onPasswordSignIn() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      await refreshApplicationConfig();
      const token = await signInWithPassword(api, email, password);
      await finishSignIn(token);
    } catch (err) {
      handleApiError(err, GENERIC_FAIL);
    } finally {
      setBusy(false);
    }
  }

  async function onRecoverySignIn() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      await refreshApplicationConfig();
      const key = decodeRecoveryKeyFromDisplay(recoveryKey);
      const token = await signInWithRecoveryKey(api, email, key);
      await finishSignIn(token);
    } catch (err) {
      if (err instanceof Error && err.message.includes("recovery key")) {
        setError(GENERIC_FAIL);
      } else {
        handleApiError(err, GENERIC_FAIL);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onForgotContinue() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      normalizeEmail(email);
      setMode("forgot-password");
    } catch {
      setError("Enter a valid email address.");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      const pw = await validatePassword(newPassword);
      if (!pw.valid) {
        setError("New password does not meet policy.");
        return;
      }
      const token = await resetPasswordWithPin(api, email, pin, newPassword);
      await refreshApplicationConfig();
      await finishSignIn(token);
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        setError("That email/PIN combination didn't work.");
      } else {
        handleApiError(err, "Password reset failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot-password") {
    const passwordOk = passwordCheck?.valid === true;
    return (
      <BrandedAuthPanel
        title="Recover with PIN"
        subtitle="Enter your email and recovery PIN, then choose a new password."
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <WarningBanner>
          You need a recovery PIN enrolled on the account. Wrong email, wrong
          PIN, and accounts without a PIN all look the same.
        </WarningBanner>
        <Field
          label="Email address"
          placeholder="name@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
        />
        <Field
          label="Recovery PIN"
          placeholder="Recovery PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          autoComplete="off"
        />
        <Field
          label="New password"
          placeholder="New password (12+ characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          type="password"
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
        {retryAfter != null ? (
          <RetryAfterMessage
            seconds={retryAfter}
            onDone={() => setRetryAfter(null)}
          />
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Working…" : "Reset password & sign in"}
          onClick={() => void onResetPassword()}
          disabled={
            busy ||
            !email.trim() ||
            !pin ||
            !passwordOk ||
            retryAfter != null
          }
        />
        <Button
          label="Back to sign in"
          variant="ghost"
          onClick={() => {
            setMode("password");
            setError(null);
            setNewPassword("");
            setPin("");
          }}
        />
      </BrandedAuthPanel>
    );
  }

  return (
    <BrandedAuthPanel
      title={title}
      subtitle={subtitle}
      footer={<PoweredByFooter appearance={appearance} />}
    >
      <Field
        label="Email address"
        placeholder="name@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        autoComplete="email"
      />

      {mode === "password" ? (
        <Field
          label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />
      ) : (
        <>
          <Muted>
            Enter your 24-word Recovery Key (space-separated).
          </Muted>
          <Field
            label="Recovery Key"
            placeholder="word1 word2 … word24"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            autoComplete="off"
          />
        </>
      )}

      {retryAfter != null ? (
        <RetryAfterMessage
          seconds={retryAfter}
          onDone={() => setRetryAfter(null)}
        />
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button
        label={busy ? "Signing in…" : "Sign in"}
        onClick={() =>
          void (mode === "password" ? onPasswordSignIn() : onRecoverySignIn())
        }
        disabled={
          busy ||
          !email.trim() ||
          (mode === "password" ? !password : !recoveryKey.trim()) ||
          retryAfter != null
        }
      />

      <div className="enclave-auth__actions-row">
        {mode === "password" ? (
          <>
            <TextLink
              label="Use Recovery Key instead"
              onClick={() => {
                setMode("recovery-key");
                setError(null);
              }}
              disabled={busy}
            />
            <TextLink
              label="Forgot password?"
              onClick={() => void onForgotContinue()}
              disabled={busy || !email.trim()}
            />
          </>
        ) : (
          <TextLink
            label="Use password instead"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            disabled={busy}
          />
        )}
      </div>
    </BrandedAuthPanel>
  );
}
