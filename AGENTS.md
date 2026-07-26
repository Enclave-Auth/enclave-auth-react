# AGENTS.md — enclave-auth-react

Drop-in React sign-in / sign-up UI for third-party web apps embedding Enclave Auth.

## Rules

1. Crypto only via `@enclave/auth-sdk` — never `@enclave/pqc-primitives` directly.
2. Call `initCrypto()` once in `EnclaveAuthProvider` before any auth flow.
3. Persist **session token only** in `localStorage` (`__enclave_auth_${applicationId}_session`).
   Never persist `identitySecretKeySeed`, AMK, or recovery keys.
4. Attach publishable key on every API call via `X-Enclave-Publishable-Key`.
   Do **not** send `X-Enclave-Developer-Console` — that header is for the Enclave
   developer console app only.
5. `brandingRemovable` comes from `application-config` — footer hide is gated on
   that server field, not a unilateral client override on free plans.
6. Scope styles under `.enclave-auth`; expose theme via CSS custom properties.
7. Session-gated profile via `auth-account-profile`; Recovery Key rotation via
   `auth-rotate-recovery-key` (did not exist before UserProfile — added alongside).

## Commands

```bash
cd ../enclave-pqc-primitives && npm run build
cd ../enclave-auth-sdk && npm run build
cd ../enclave-auth-react
npm install
npm run build
npm test
```
