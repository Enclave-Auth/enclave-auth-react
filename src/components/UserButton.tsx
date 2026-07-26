import { useEffect, useRef, useState } from "react";

import { useAuth } from "../context/EnclaveAuthProvider.js";

export type UserButtonProps = {
  /** Label shown beside the avatar when signed in. */
  label?: string;
};

/**
 * Minimal signed-in indicator with sign-out — embed in the host app's nav.
 * Naming follows Clerk's {@code UserButton} convention.
 */
export function UserButton({ label = "Account" }: UserButtonProps) {
  const { isSignedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="enclave-auth__user-button-wrap" ref={wrapRef}>
      <button
        type="button"
        className="enclave-auth__user-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="enclave-auth__avatar" aria-hidden>
          {label.charAt(0).toUpperCase()}
        </span>
        <span>{label}</span>
      </button>
      {open ? (
        <div className="enclave-auth__user-button-menu" role="menu">
          <button
            type="button"
            className="enclave-auth__menu-item"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
