/** CSS custom property names exposed on `.enclave-auth`. */
export const ENCLAVE_AUTH_THEME_VARS = [
  "--enclave-auth-color-bg",
  "--enclave-auth-color-panel",
  "--enclave-auth-color-text",
  "--enclave-auth-color-text-soft",
  "--enclave-auth-color-muted",
  "--enclave-auth-color-accent",
  "--enclave-auth-color-accent-pressed",
  "--enclave-auth-color-accent-soft",
  "--enclave-auth-color-border",
  "--enclave-auth-color-border-soft",
  "--enclave-auth-color-input-bg",
  "--enclave-auth-color-danger",
  "--enclave-auth-radius-sm",
  "--enclave-auth-spacing-xs",
  "--enclave-auth-spacing-sm",
  "--enclave-auth-spacing-md",
  "--enclave-auth-spacing-lg",
  "--enclave-auth-font-family",
  "--enclave-auth-font-family-display",
] as const;

export type EnclaveAuthThemeVar = (typeof ENCLAVE_AUTH_THEME_VARS)[number];

export type EnclaveAuthTheme = Partial<
  Record<EnclaveAuthThemeVar, string>
>;

/** Defaults aligned with enclave-auth / enclave-auth-landing tokens. */
export const DEFAULT_THEME: EnclaveAuthTheme = {
  "--enclave-auth-color-bg": "#0A0A0A",
  "--enclave-auth-color-panel": "#161616",
  "--enclave-auth-color-text": "#FFFFFF",
  "--enclave-auth-color-text-soft": "rgba(255,255,255,0.8)",
  "--enclave-auth-color-muted": "#8A8A8A",
  "--enclave-auth-color-accent": "#FF6A1F",
  "--enclave-auth-color-accent-pressed": "#E55E15",
  "--enclave-auth-color-accent-soft": "rgba(255, 106, 31, 0.25)",
  "--enclave-auth-color-border": "#8A8A8A",
  "--enclave-auth-color-border-soft": "rgba(255,255,255,0.15)",
  "--enclave-auth-color-input-bg": "rgba(255,255,255,0.08)",
  "--enclave-auth-color-danger": "#f87171",
  "--enclave-auth-radius-sm": "2px",
  "--enclave-auth-spacing-xs": "4px",
  "--enclave-auth-spacing-sm": "8px",
  "--enclave-auth-spacing-md": "16px",
  "--enclave-auth-spacing-lg": "24px",
  "--enclave-auth-font-family":
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--enclave-auth-font-family-display":
    '"Roboto Slab", Georgia, serif',
};

export function mergeTheme(
  overrides?: EnclaveAuthTheme,
): EnclaveAuthTheme {
  return { ...DEFAULT_THEME, ...overrides };
}

export function themeToStyle(
  theme: EnclaveAuthTheme,
): Record<string, string> {
  return theme as Record<string, string>;
}
