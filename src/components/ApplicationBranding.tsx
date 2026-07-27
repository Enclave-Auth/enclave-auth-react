import type { ApplicationBrandingConfig } from "../api/types.js";

export function ApplicationBranding({
  branding,
}: {
  branding?: ApplicationBrandingConfig | null;
}) {
  if (!branding?.displayName && !branding?.logoUrl) {
    return null;
  }

  return (
    <div className="enclave-auth__branding">
      {branding.logoUrl ? (
        <img
          className="enclave-auth__branding-logo"
          src={branding.logoUrl}
          alt={branding.displayName ?? "Application logo"}
        />
      ) : null}
      {branding.displayName ? (
        <p className="enclave-auth__branding-name">{branding.displayName}</p>
      ) : null}
    </div>
  );
}
