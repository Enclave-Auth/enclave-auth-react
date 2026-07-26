import type { ReactNode } from "react";

import type { ApplicationConfig } from "../api/types.js";
import type { AuthApiClient } from "../api/client.js";
import type { EnclaveAuthTheme } from "../theme/defaults.js";

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
  /** Injectable fetch — tests only in production builds. */
  fetchImpl?: typeof fetch;
  children: ReactNode;
};
