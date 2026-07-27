import type { ReactNode } from "react";

import type { ApplicationConfig } from "../api/types.js";
import type { AuthApiClient } from "../api/client.js";
import type { EnclaveAuthTheme } from "../theme/defaults.js";
import type { EnclaveAuthEmbedMode } from "../hosted-auth.js";

export type EnclaveAuthAppearance = {
  /**
   * Hide the "Powered by Enclave Auth" footer. Only honored when the
   * Application's public config has `brandingRemovable: true` (paid plans).
   * On free plans the footer always renders regardless of this prop.
   */
  showPoweredBy?: boolean;
};

export type EnclaveAuthContextValue = {
  api: AuthApiClient;
  apiBaseUrl: string;
  publishableKey: string;
  applicationId: string | null;
  config: ApplicationConfig | null;
  configError: string | null;
  isReady: boolean;
  sessionToken: string | null;
  isSignedIn: boolean;
  theme: EnclaveAuthTheme;
  setSession: (sessionToken: string) => void;
  signOut: () => void;
  shouldShowPoweredBy: (appearance?: EnclaveAuthAppearance) => boolean;
};

export type EnclaveAuthProviderProps = {
  publishableKey: string;
  apiBaseUrl: string;
  theme?: EnclaveAuthTheme;
  /** Which hosted page mode to use when redirecting free-tier embeds. */
  embedMode?: EnclaveAuthEmbedMode;
  /** Base URL of the hosted auth site (default https://auth.enclave.talk). */
  hostedAuthBaseUrl?: string;
  /**
   * When true (default), free-tier / origin-blocked clients redirect to the
   * hosted UI instead of rendering inline. Set false on /hosted-auth itself.
   */
  enableHostedFallback?: boolean;
  /** Injectable fetch — tests only in production builds. */
  fetchImpl?: typeof fetch;
  children: ReactNode;
};
