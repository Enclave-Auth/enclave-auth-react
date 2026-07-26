export {
  EnclaveAuthProvider,
  useAuth,
  useEnclaveAuthContext,
} from "./context/EnclaveAuthProvider.js";

export { SignIn, type SignInProps } from "./components/SignIn.js";
export { SignUp, type SignUpProps } from "./components/SignUp.js";
export { UserProfile, type UserProfileProps } from "./components/UserProfile.js";
export { UserButton, type UserButtonProps } from "./components/UserButton.js";
export { PoweredByFooter } from "./components/PoweredByFooter.js";

export { AuthApiError, createAuthApiClient } from "./api/client.js";
export type { ApplicationConfig } from "./api/types.js";
export type {
  EnclaveAuthAppearance,
  EnclaveAuthProviderProps,
} from "./context/types.js";
export {
  DEFAULT_THEME,
  ENCLAVE_AUTH_THEME_VARS,
  mergeTheme,
  type EnclaveAuthTheme,
  type EnclaveAuthThemeVar,
} from "./theme/defaults.js";

export { sessionStorageKey } from "./session/storage.js";
