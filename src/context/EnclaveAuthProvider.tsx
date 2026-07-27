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

import { AuthApiError } from "../api/client.js";
import type { ApplicationConfig } from "../api/types.js";
import { createAuthApiClient } from "../api/client.js";
import {
  buildHostedAuthRedirectUrl,
  currentReturnUrl,
  isHostedAuthSiteLocation,
  redirectToHostedAuth,
  HOSTED_AUTH_SITE_ORIGIN,
} from "../hosted-auth.js";
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

function shouldRedirectToHosted(enableHostedFallback: boolean): boolean {
  if (!enableHostedFallback) return false;
  if (typeof window === "undefined") return false;
  return !isHostedAuthSiteLocation(window.location);
}

function resolveHostedRedirectUrl(
  publishableKey: string,
  embedMode: EnclaveAuthProviderProps["embedMode"],
  hostedAuthBaseUrl: string,
  config: ApplicationConfig | null,
): string {
  if (config?.hostedAuthUrl) {
    const url = new URL(config.hostedAuthUrl);
    if (embedMode && embedMode !== "sign-in") {
      url.searchParams.set("mode", embedMode);
    }
    const returnUrl = currentReturnUrl();
    if (returnUrl) {
      url.searchParams.set("return_url", returnUrl);
    }
    return url.toString();
  }

  return buildHostedAuthRedirectUrl(
    hostedAuthBaseUrl,
    publishableKey,
    embedMode ?? "sign-in",
    currentReturnUrl(),
  );
}

type LoadConfigResult =
  | { ok: true; config: ApplicationConfig }
  | { ok: false; redirecting: true }
  | { ok: false; redirecting: false; error: string };

export function EnclaveAuthProvider({
  publishableKey,
  apiBaseUrl,
  theme: themeOverrides,
  embedMode = "sign-in",
  hostedAuthBaseUrl = HOSTED_AUTH_SITE_ORIGIN,
  enableHostedFallback = true,
  fetchImpl,
  children,
}: EnclaveAuthProviderProps) {
  const theme = useMemo(() => mergeTheme(themeOverrides), [themeOverrides]);
  const api = useMemo(
    () => createAuthApiClient({ apiBaseUrl, publishableKey, fetchImpl }),
    [apiBaseUrl, publishableKey, fetchImpl],
  );

  const [isReady, setIsReady] = useState(false);
  /**
   * embeddingPermitted lives only in React state — never localStorage/sessionStorage.
   * Supplemental License Terms Section 4 depends on fresh server checks at auth events.
   */
  const [config, setConfig] = useState<ApplicationConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [redirectingHosted, setRedirectingHosted] = useState(false);

  const loadApplicationConfig = useCallback(async (): Promise<LoadConfigResult> => {
    const appConfig = await api.fetchApplicationConfig();

    if (
      !appConfig.embeddingPermitted &&
      shouldRedirectToHosted(enableHostedFallback)
    ) {
      setRedirectingHosted(true);
      redirectToHostedAuth(
        resolveHostedRedirectUrl(
          publishableKey,
          embedMode,
          hostedAuthBaseUrl,
          appConfig,
        ),
      );
      return { ok: false, redirecting: true };
    }

    setConfig(appConfig);
    setConfigError(null);
    return { ok: true, config: appConfig };
  }, [
    api,
    publishableKey,
    embedMode,
    hostedAuthBaseUrl,
    enableHostedFallback,
  ]);

  /**
   * Re-fetch plan entitlement immediately before sign-in/sign-up.
   * No cross-request cache — each auth attempt hits application-config fresh.
   */
  const refreshApplicationConfig = useCallback(async (): Promise<ApplicationConfig> => {
    try {
      const result = await loadApplicationConfig();
      if (result.ok) {
        return result.config;
      }
      if (result.redirecting) {
        throw new Error("Redirecting to hosted auth");
      }
      throw new Error(result.error);
    } catch (err) {
      if (
        err instanceof AuthApiError &&
        err.status === 401 &&
        shouldRedirectToHosted(enableHostedFallback)
      ) {
        setRedirectingHosted(true);
        redirectToHostedAuth(
          resolveHostedRedirectUrl(
            publishableKey,
            embedMode,
            hostedAuthBaseUrl,
            null,
          ),
        );
        throw err;
      }
      throw err;
    }
  }, [
    loadApplicationConfig,
    publishableKey,
    embedMode,
    hostedAuthBaseUrl,
    enableHostedFallback,
  ]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await initCrypto();
        const result = await loadApplicationConfig();
        if (cancelled) return;

        if (result.ok) {
          const cached = readSessionToken(result.config.applicationId);
          setSessionTokenState(cached);
        }
      } catch (err) {
        if (cancelled) return;

        if (
          err instanceof AuthApiError &&
          err.status === 401 &&
          shouldRedirectToHosted(enableHostedFallback)
        ) {
          setRedirectingHosted(true);
          redirectToHostedAuth(
            resolveHostedRedirectUrl(
              publishableKey,
              embedMode,
              hostedAuthBaseUrl,
              null,
            ),
          );
          return;
        }

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
  }, [loadApplicationConfig, publishableKey, embedMode, hostedAuthBaseUrl, enableHostedFallback]);

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
      refreshApplicationConfig,
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
      refreshApplicationConfig,
    ],
  );

  const style = themeToStyle(theme) as CSSProperties;

  if (redirectingHosted) {
    return (
      <div className="enclave-auth enclave-auth__loading" style={style}>
        Redirecting to Enclave Auth…
      </div>
    );
  }

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
