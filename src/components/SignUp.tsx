import { useEffect, useMemo, useState } from "react";
import {
  checkConfirmationWords,
  createAccount,
  getRecoveryKeyWords,
  isPairwiseConsistencyFailure,
  pickConfirmationIndices,
  setPinMethod,
  validatePassword,
  validatePin,
  type CreateAccountResult,
  type PasswordValidationResult,
  type PinValidationResult,
} from "@enclave/auth-sdk";

import { AuthApiError } from "../api/client.js";
import { encodePublicKey, mintSessionFromIdentitySeed } from "../crypto/flows.js";
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

type Step =
  | "email"
  | "code"
  | "password"
  | "recovery-key"
  | "confirm"
  | "pin";

type PendingAccount = {
  email: string;
  account: CreateAccountResult;
  words: string[];
};

function wipePendingAccount(pending: PendingAccount | null): void {
  if (!pending) return;
  pending.account.amk.fill(0);
  pending.account.identitySecretKeySeed.fill(0);
  pending.account.recoveryKey.fill(0);
}

export type SignUpProps = {
  title?: string;
  appearance?: EnclaveAuthAppearance;
  onSuccess?: () => void;
};

export function SignUp({
  title = "Create your account",
  appearance,
  onSuccess,
}: SignUpProps) {
  const { api, setSession, refreshApplicationConfig } = useEnclaveAuthContext();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(
    null,
  );
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] =
    useState<PasswordValidationResult | null>(null);
  const [pending, setPending] = useState<PendingAccount | null>(null);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>(
    {},
  );
  const [pin, setPin] = useState("");
  const [pinCheck, setPinCheck] = useState<PinValidationResult | null>(null);
  const [sessionToken, setSessionTokenLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      wipePendingAccount(pending);
    };
  }, [pending]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!password) {
        setPasswordCheck(null);
        return;
      }
      const result = await validatePassword(password);
      if (!cancelled) setPasswordCheck(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [password]);

  useEffect(() => {
    if (!pin) {
      setPinCheck(null);
      return;
    }
    setPinCheck(validatePin(pin));
  }, [pin]);

  const passwordOk = passwordCheck?.valid === true;
  const pinOk = pinCheck?.valid === true;
  const wordsDisplay = useMemo(() => pending?.words ?? [], [pending?.words]);

  function onApiError(err: unknown, fallback: string) {
    if (err instanceof AuthApiError && err.status === 429) {
      setRetryAfter(err.retryAfterSeconds ?? 60);
      setError(null);
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }

  async function finishAuthenticated(token: string) {
    await refreshApplicationConfig();
    setSession(token);
    wipePendingAccount(pending);
    setPending(null);
    onSuccess?.();
  }

  async function onRequestCode() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      await api.requestEmailVerification(email.trim().toLowerCase());
      setCode("");
      setStep("code");
    } catch (err) {
      onApiError(err, "Could not send verification email");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode() {
    setError(null);
    setRetryAfter(null);
    setBusy(true);
    try {
      const result = await api.verifyEmailCode(
        email.trim().toLowerCase(),
        code.trim(),
      );
      setVerificationToken(result.verificationToken);
      setStep("password");
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 429) {
        setRetryAfter(err.retryAfterSeconds ?? 60);
        setError(null);
      } else {
        setError("Incorrect code. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAccount() {
    if (!verificationToken) {
      setError("Email verification expired — start again.");
      setStep("email");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const pw = await validatePassword(password);
      if (!pw.valid) {
        setError(
          pw.reason === "breached"
            ? "That password appears in known breach lists. Choose another."
            : pw.reason === "too_short"
              ? "Password must be at least 12 characters."
              : "Password does not meet policy.",
        );
        return;
      }

      const account = await createAccount(password);
      const normalized = email.trim().toLowerCase();

      await api.registerAccount({
        email: normalized,
        identityPublicKey: encodePublicKey(account.identityPublicKey),
        wrappedIdentityKey: account.wrappedIdentityKey,
        passwordUnlock: account.passwordUnlock,
        recoveryUnlock: account.recoveryUnlock,
        verificationToken,
      });

      const words = getRecoveryKeyWords(account.recoveryKey);
      setPending({ email: normalized, account, words });
      setConfirmIndices(pickConfirmationIndices(3));
      setConfirmInputs({});
      setStep("recovery-key");
    } catch (err) {
      if (isPairwiseConsistencyFailure(err)) {
        setError(
          "Key generation failed on this device. Please retry, or try a different browser.",
        );
      } else if (err instanceof AuthApiError && err.status === 409) {
        setError("An account already exists for this email.");
      } else if (err instanceof AuthApiError && err.status === 400) {
        setError(
          "Email verification expired or invalid — request a new code.",
        );
        setVerificationToken(null);
        setStep("email");
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setBusy(false);
    }
  }

  function onConfirmWords() {
    if (!pending) return;
    const ok = checkConfirmationWords(
      pending.words,
      confirmIndices,
      confirmInputs,
    );
    if (!ok) {
      setError("Those words don't match. Try again.");
      return;
    }
    setError(null);
    void (async () => {
      setBusy(true);
      try {
        const token = await mintSessionFromIdentitySeed(
          api,
          pending.email,
          pending.account.identitySecretKeySeed,
        );
        await refreshApplicationConfig();
        setSessionTokenLocal(token);
        setStep("pin");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Account created but sign-in failed — try Sign in.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }

  async function onEnrollPin() {
    if (!pending || !sessionToken) return;
    setError(null);
    setBusy(true);
    try {
      const pv = validatePin(pin);
      if (!pv.valid) {
        setError(
          pv.reason === "too_short"
            ? "PIN must be at least 8 characters."
            : "Choose a stronger PIN (avoid sequences and common patterns).",
        );
        return;
      }
      const enrolled = await setPinMethod(pending.account.amk, pin);
      await api.enrollPin(
        {
          verificationHash: enrolled.verificationHash,
          pinUnlock: enrolled.pinUnlock,
        },
        sessionToken,
      );
      await finishAuthenticated(sessionToken);
    } catch (err) {
      onApiError(err, "Could not enroll PIN");
    } finally {
      setBusy(false);
    }
  }

  async function onSkipPin() {
    if (!sessionToken) return;
    setError(null);
    setBusy(true);
    try {
      await finishAuthenticated(sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish sign-in");
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryKey() {
    if (!wordsDisplay.length) return;
    try {
      await navigator.clipboard.writeText(wordsDisplay.join(" "));
    } catch {
      /* clipboard may be unavailable */
    }
  }

  if (step === "email") {
    return (
      <BrandedAuthPanel
        title={title}
        subtitle="Enter your email — we'll send a verification code before you choose a password."
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
        {retryAfter != null ? (
          <RetryAfterMessage
            seconds={retryAfter}
            onDone={() => setRetryAfter(null)}
          />
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Sending…" : "Continue ›"}
          onClick={() => void onRequestCode()}
          disabled={busy || !email.includes("@") || retryAfter != null}
        />
      </BrandedAuthPanel>
    );
  }

  if (step === "code") {
    return (
      <BrandedAuthPanel
        title="Check your email"
        subtitle={`Enter the 6-digit code we sent to ${email.trim().toLowerCase()}.`}
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <Field
          label="Verification code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
        />
        {retryAfter != null ? (
          <RetryAfterMessage
            seconds={retryAfter}
            onDone={() => setRetryAfter(null)}
          />
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Verifying…" : "Continue ›"}
          onClick={() => void onVerifyCode()}
          disabled={busy || code.trim().length !== 6 || retryAfter != null}
        />
        <Button
          label={busy ? "Working…" : "Resend code"}
          variant="ghost"
          onClick={() => void onRequestCode()}
          disabled={busy || retryAfter != null}
        />
        <TextLink
          label="Use a different email"
          onClick={() => {
            setStep("email");
            setVerificationToken(null);
            setError(null);
          }}
          disabled={busy}
        />
      </BrandedAuthPanel>
    );
  }

  if (step === "password") {
    return (
      <BrandedAuthPanel
        title="Choose a password"
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <Muted>
          At least 12 characters. We check known breaches — no composition
          rules.
        </Muted>
        <Field
          label="Password"
          placeholder="Password (12+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
        />
        {password && passwordCheck && !passwordCheck.valid ? (
          <ErrorText>
            {passwordCheck.reason === "too_short"
              ? "At least 12 characters required."
              : passwordCheck.reason === "too_long"
                ? "Password is too long."
                : passwordCheck.reason === "breached"
                  ? "Found in known breach lists — choose another."
                  : "Password rejected."}
          </ErrorText>
        ) : null}
        {passwordCheck?.valid && passwordCheck.checkFailed ? (
          <Muted>
            Couldn&apos;t reach the breach list — registration can continue.
          </Muted>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Creating…" : "Create account"}
          onClick={() => void onCreateAccount()}
          disabled={busy || !passwordOk}
        />
      </BrandedAuthPanel>
    );
  }

  if (step === "recovery-key" && pending) {
    return (
      <BrandedAuthPanel
        title="Save your Recovery Key"
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <WarningBanner>
          Save this now — it&apos;s the only way back into your account if you
          forget your password. We cannot show it to you again.
        </WarningBanner>
        <div className="enclave-auth__word-grid">
          {wordsDisplay.map((word, i) => (
            <div key={`w-${i}`} className="enclave-auth__word-cell">
              <span className="enclave-auth__word-index">{i + 1}</span>
              <span className="enclave-auth__word-text">{word}</span>
            </div>
          ))}
        </div>
        <Button
          label="Copy all"
          variant="ghost"
          onClick={() => void copyRecoveryKey()}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label="I've saved it — continue"
          onClick={() => {
            setConfirmIndices(pickConfirmationIndices(3));
            setConfirmInputs({});
            setError(null);
            setStep("confirm");
          }}
        />
      </BrandedAuthPanel>
    );
  }

  if (step === "confirm" && pending) {
    return (
      <BrandedAuthPanel
        title="Confirm your Recovery Key"
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <Muted>
          Enter the words at the numbers below to confirm you saved them.
        </Muted>
        {confirmIndices.map((idx) => (
          <Field
            key={`c-${idx}`}
            label={`Enter word #${idx + 1}`}
            placeholder={`Word #${idx + 1}`}
            value={confirmInputs[idx] ?? ""}
            onChange={(e) =>
              setConfirmInputs((prev) => ({ ...prev, [idx]: e.target.value }))
            }
            autoComplete="off"
          />
        ))}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Working…" : "Confirm"}
          onClick={onConfirmWords}
          disabled={
            busy ||
            confirmIndices.some((i) => !(confirmInputs[i] ?? "").trim())
          }
        />
        <Button
          label="Show Recovery Key again"
          variant="ghost"
          onClick={() => {
            setStep("recovery-key");
            setError(null);
          }}
        />
      </BrandedAuthPanel>
    );
  }

  if (step === "pin") {
    return (
      <BrandedAuthPanel
        title="Password-reset PIN"
        footer={<PoweredByFooter appearance={appearance} />}
      >
        <Muted>
          Optional but recommended. If you forget your password, email + this
          PIN recover your account without losing your encrypted data.
        </Muted>
        <Field
          label="PIN"
          placeholder="PIN (8+ characters)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          autoComplete="off"
        />
        {pin && pinCheck && !pinCheck.valid ? (
          <ErrorText>
            {pinCheck.reason === "too_short"
              ? "PIN must be at least 8 characters."
              : "PIN is too predictable — avoid sequences and common values."}
          </ErrorText>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? "Working…" : "Enable PIN"}
          onClick={() => void onEnrollPin()}
          disabled={busy || !pinOk}
        />
        <Button
          label="Skip for now"
          variant="ghost"
          onClick={() => void onSkipPin()}
          disabled={busy}
        />
      </BrandedAuthPanel>
    );
  }

  return (
    <BrandedAuthPanel title={title} footer={<PoweredByFooter appearance={appearance} />}>
      <Muted>Loading…</Muted>
    </BrandedAuthPanel>
  );
}
