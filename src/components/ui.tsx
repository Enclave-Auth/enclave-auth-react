import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = {
  label?: string;
  error?: string | null;
} & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, error, className, ...rest }: FieldProps) {
  return (
    <label className={`enclave-auth__field ${className ?? ""}`.trim()}>
      {label ? <span className="enclave-auth__label">{label}</span> : null}
      <input className="enclave-auth__input" {...rest} />
      {error ? <span className="enclave-auth__error">{error}</span> : null}
    </label>
  );
}

export function Button({
  label,
  variant = "primary",
  ...rest
}: {
  label: string;
  variant?: "primary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls =
    variant === "ghost"
      ? "enclave-auth__button enclave-auth__button--ghost"
      : "enclave-auth__button";
  return (
    <button type="button" className={cls} {...rest}>
      {label}
    </button>
  );
}

export function TextLink({
  label,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="enclave-auth__link" {...rest}>
      {label}
    </button>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="enclave-auth__error">{children}</p>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="enclave-auth__muted">{children}</p>;
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return <div className="enclave-auth__warning">{children}</div>;
}

export function RetryAfterMessage({
  seconds,
  onDone,
}: {
  seconds: number;
  onDone?: () => void;
}) {
  return <RetryAfterCountdown seconds={seconds} onDone={onDone} />;
}

function RetryAfterCountdown({
  seconds: initial,
  onDone,
}: {
  seconds: number;
  onDone?: () => void;
}) {
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    setRemaining(initial);
  }, [initial]);

  useEffect(() => {
    if (remaining <= 0) {
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining, onDone]);

  if (remaining <= 0) return null;

  return (
    <p className="enclave-auth__retry">
      Too many attempts. Try again in {remaining}s.
    </p>
  );
}

export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="enclave-auth__panel">
      <h2 className="enclave-auth__title">{title}</h2>
      {subtitle ? <p className="enclave-auth__subtitle">{subtitle}</p> : null}
      {children}
      {footer}
    </div>
  );
}
