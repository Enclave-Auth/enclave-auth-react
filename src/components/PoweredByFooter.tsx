/**
 * "Powered by Enclave Auth" footer for embedded sign-in / sign-up panels.
 *
 * Visibility is gated by the Application's public `brandingRemovable` config
 * (fetched by {@link EnclaveAuthProvider}) — not a unilateral client override
 * on free plans. This is a soft, ToS-level control: a motivated integrator can
 * always hide the footer with their own CSS regardless of plan tier, same as
 * every other "Powered by" watermark in the industry.
 */

import { useEnclaveAuthContext } from "../context/EnclaveAuthProvider.js";
import type { EnclaveAuthAppearance } from "../context/types.js";

const POWERED_BY_URL = "https://auth.enclave.tech";

export function PoweredByFooter({
  appearance,
}: {
  appearance?: EnclaveAuthAppearance;
}) {
  const { shouldShowPoweredBy } = useEnclaveAuthContext();

  if (!shouldShowPoweredBy(appearance)) {
    return null;
  }

  return (
    <p className="enclave-auth__footer">
      Powered by{" "}
      <a href={POWERED_BY_URL} target="_blank" rel="noopener noreferrer">
        Enclave Auth
      </a>
    </p>
  );
}
