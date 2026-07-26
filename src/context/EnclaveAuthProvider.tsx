import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { initCrypto } from "@enclave/auth-sdk";

import { createAuthApiClient } from "../api/client.js";
import type { ApplicationConfig } from "../api/types.js";
import {
  clearSessionToken,
  readSessionToken,
  writeSessionToken,
} from "../session/storage.js";
import { mergeTheme, themeToStyle } from "../theme/defaults.js";
import type {
  EnclaveAuthAppearance,
  EnclaveAuthContextValue,
  EnclaveAuthProviderProps,
} from "./types.js";

const EnclaveAuthContext = createContext<EnclaveAuthContextValue | null>(null);

export function EnclaveAuthProvider({
  publishableKey,
  apiBaseUrl,
  theme: themeOverrides,
  fetchImpl,
  children,
}: EnclaveAuthProviderProps) {
  const theme = useMemo(() => mergeTheme(themeOverrides), [themeOverrides]);
  const api = useMemo(
    () => createAuthApiClient({ apiBaseUrl, publishableKey, fetchImpl }),
    [apiBaseUrl, publishableKey, fetchImpl],
  );

  const [isReady, setIsReady] = useState(false);
  const [config, setConfig] = useState<ApplicationConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await initCrypto();
        const appConfig = await api.fetchApplicationConfig();
        if (cancelled) return;

        setConfig(appConfig);
        setConfigError(null);
        const cached = readSessionToken(appConfig.applicationId);
        setSessionTokenState(cached);
      } catch (err) {
        if (cancelled) return;
        setConfigError(
          err instanceof Error
            ? err.message
            : "Failed to load Application config",
        );
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const setSession = useCallback(
    (token: string) => {
      if (!config?.applicationId) return;
      writeSessionToken(config.applicationId, token);
      setSessionTokenState(token);
    },
    [config?.applicationId],
  );

  const signOut = useCallback(() => {
    if (config?.applicationId) {
      clearSessionToken(config.applicationId);
    }
    setSessionTokenState(null);
  }, [config?.applicationId]);

  const shouldShowPoweredBy = useCallback(
    (appearance?: EnclaveAuthAppearance) => {
      if (!config?.brandingRemovable) return true;
      if (appearance?.showPoweredBy === false) return false;
      return true;
    },
    [config?.brandingRemovable],
  );

  const value = useMemo<EnclaveAuthContextValue>(
    () => ({
      api,
      apiBaseUrl,
      publishableKey,
      applicationId: config?.applicationId ?? null,
      config,
      configError,
      isReady,
      sessionToken,
      isSignedIn: sessionToken != null && sessionToken.length > 0,
      theme,
      setSession,
      signOut,
      shouldShowPoweredBy,
    }),
    [
      api,
      apiBaseUrl,
      publishableKey,
      config,
      configError,
      isReady,
      sessionToken,
      theme,
      setSession,
      signOut,
      shouldShowPoweredBy,
    ],
  );

  const style = themeToStyle(theme) as CSSProperties;

  if (configError) {
    return (
      <div className="enclave-auth enclave-auth__config-error" style={style}>
        Enclave Auth configuration failed: {configError}
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="enclave-auth enclave-auth__loading" style={style}>
        Loading…
      </div>
    );
  }

  return (
    <EnclaveAuthContext.Provider value={value}>
      <div className="enclave-auth" style={style}>
        {children}
      </div>
    </EnclaveAuthContext.Provider>
  );
}

export function useEnclaveAuthContext(): EnclaveAuthContextValue {
  const ctx = useContext(EnclaveAuthContext);
  if (!ctx) {
    throw new Error(
      "Enclave Auth components must be rendered inside <EnclaveAuthProvider>",
    );
  }
  return ctx;
}

export function useAuth(): Pick<
  EnclaveAuthContextValue,
  "isSignedIn" | "sessionToken" | "signOut"
> {
  const { isSignedIn, sessionToken, signOut } = useEnclaveAuthContext();
  return { isSignedIn, sessionToken, signOut };
}
