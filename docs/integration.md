# @enclave/auth-react — Integration guide

Drop-in React components for Enclave Auth sign-in, sign-up, and account
management. Auth UI renders **inline on your page** — users are never redirected
to an Enclave-hosted login URL.

**Repository:** [github.com/Enclave-Auth/enclave-auth-react](https://github.com/Enclave-Auth/enclave-auth-react)

---

## Quickstart

### Prerequisites

1. **Enclave Auth developer account** — sign in at
   [auth.enclave.talk/login](https://auth.enclave.talk/login).
2. **Create an Application** — open
   [auth.enclave.talk/dashboard](https://auth.enclave.talk/dashboard), choose
   **New application**, and give it a name.
3. **Copy your publishable key** — in the Application sidebar, open
   **Authentication → API keys**. The **publishable** key (`pk_live_…`) is shown
   at creation; use **Rotate** to issue a new one (the full value is shown once).
4. **Allow-list your dev origin** — still under **Authentication**, in
   **Allowed origins**, add every origin your browser app runs on (one per line),
   for example:

   ```text
   http://localhost:5173
   http://127.0.0.1:5173
   ```

   Click **Save origins**. Browsers send an `Origin` header on API calls; if your
   page's origin is not listed, requests fail with `401 Unauthorized` (see
   [Origin and key setup](#origin-and-publishable-key-setup)).
5. **API base URL** — use your Enclave Auth API functions URL (no trailing
   slash), for example:

   ```text
   https://<project-ref>.supabase.co/functions/v1
   ```

   Enclave-hosted production uses
   `https://osaeeaarqihtsxcrmxyk.supabase.co/functions/v1`.

### Install

`@enclave/auth-react` is **not on npm yet** (first publish pending). Until
`npm install @enclave/auth-react` resolves, install from GitHub:

```bash
npm install github:Enclave-Auth/enclave-auth-react#main
```

After the package is published:

```bash
npm install @enclave/auth-react
```

Peer dependency: **React 18+**. The package depends on `@enclave/auth-sdk`
(crypto) automatically — you do not install primitives separately.

Import the stylesheet **once** in your app entry:

```tsx
import "@enclave/auth-react/styles.css";
```

### Minimal working example (Vite + React)

Create a new Vite app (`npm create vite@latest my-app -- --template react-ts`),
then replace `src/main.tsx` and add `.env.local`:

**.env.local**

```bash
VITE_ENCLAVE_PUBLISHABLE_KEY=pk_live_your_key_here
VITE_ENCLAVE_API_BASE_URL=https://osaeeaarqihtsxcrmxyk.supabase.co/functions/v1
```

**src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  EnclaveAuthProvider,
  SignIn,
  UserButton,
  useAuth,
} from "@enclave/auth-react";
import "@enclave/auth-react/styles.css";

const publishableKey = import.meta.env.VITE_ENCLAVE_PUBLISHABLE_KEY;
const apiBaseUrl = import.meta.env.VITE_ENCLAVE_API_BASE_URL;

if (!publishableKey?.startsWith("pk_live_")) {
  throw new Error("Set VITE_ENCLAVE_PUBLISHABLE_KEY in .env.local");
}
if (!apiBaseUrl) {
  throw new Error("Set VITE_ENCLAVE_API_BASE_URL in .env.local");
}

function AppShell() {
  const { isSignedIn } = useAuth();

  return (
    <>
      <header style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
        <strong>My app</strong>
        <div style={{ marginLeft: "auto" }}>
          {isSignedIn ? <UserButton label="Account" /> : null}
        </div>
      </header>
      <main style={{ padding: "1rem" }}>
        {isSignedIn ? (
          <p>Signed in. Use UserButton to sign out.</p>
        ) : (
          <SignIn />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnclaveAuthProvider
      publishableKey={publishableKey}
      apiBaseUrl={apiBaseUrl}
    >
      <AppShell />
    </EnclaveAuthProvider>
  </StrictMode>,
);
```

Run:

```bash
npm install github:Enclave-Auth/enclave-auth-react#main
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should see the
sign-in form; after a successful login, **UserButton** appears in the header.

### Verify your setup

From the `enclave-auth-react` repo (or after copying
`scripts/verify-quickstart.mjs`):

```bash
ENCLAVE_AUTH_PUBLISHABLE_KEY=pk_live_… \
ENCLAVE_AUTH_API_BASE_URL=https://….supabase.co/functions/v1 \
ENCLAVE_AUTH_TEST_ORIGIN=http://localhost:5173 \
node scripts/verify-quickstart.mjs
```

This checks invalid-key and origin-gating behavior and confirms
`application-config` returns `applicationId` and `brandingRemovable`.

---

## Core concepts

### Zero-knowledge login (what integrators need to know)

Enclave Auth never receives the user's password. On sign-in, the client derives
keys locally, fetches encrypted account blobs from the API, unlocks them with
the password, and completes a **challenge → ML-DSA signature → session token**
exchange. The server verifies the signature against the account's identity
public key; the password itself never leaves the browser. Encrypted wraps stored
server-side are opaque to Enclave.

### Three unlock methods

| Method | When users use it | Integrator notes |
|--------|-------------------|------------------|
| **Password** | Everyday sign-in | Default `<SignIn />` mode. |
| **PIN** | Forgot-password recovery on `<SignIn />` | Optional at registration (`<SignUp />`). Not a day-to-day unlock in auth-react today. |
| **Recovery Key** | Account recovery; 24-word BIP39-style phrase | Shown once at sign-up; `<SignIn />` offers "Use Recovery Key instead". `<UserProfile />` can rotate it when signed in. |

All cryptography runs in the browser via `@enclave/auth-sdk` (post-quantum
ML-KEM / ML-DSA, Category 5).

### Plan tiers and embedded UI behavior

**All plans (Free, Standard, Plus, Enterprise)** use the same embedded model:
`<SignIn />`, `<SignUp />`, and related components render on **your** origin.
There is no Free-tier redirect to an Enclave-hosted login page in
`@enclave/auth-react`.

The meaningful UI difference today is **branding**:

| Plan | `brandingRemovable` | Footer behavior |
|------|---------------------|-----------------|
| **Free** | `false` | "Powered by Enclave Auth" footer always shown on `<SignIn />`, `<SignUp />`, and `<UserProfile />`. |
| **Standard / Plus / Enterprise** | `true` | Footer shown by default; hide with `appearance={{ showPoweredBy: false }}` on each component. |

Your Application's plan is exposed publicly via `POST /application-config`
(fetched automatically by `<EnclaveAuthProvider>`).

Paid plans also raise MAU caps (see
[auth.enclave.talk/pricing](https://auth.enclave.talk/pricing)); that affects
billing, not how components mount.

### Session persistence

Only the **session JWT** is stored in `localStorage` at
`__enclave_auth_${applicationId}_session`. Identity seeds, AMK, and recovery
material stay in memory during an operation and are wiped afterward. Use
`useAuth().sessionToken` as a `Bearer` token when calling your backend or
Enclave session-gated APIs.

### Not available yet

The developer console lists **Organizations** and **Platform** as **coming
soon** — multi-tenant teams and white-label platform identity are not wired to
production APIs. `<UserProfile />` also shows **Sessions & devices** as coming
soon (multi-device session management).

---

## Component API reference

All components must be descendants of `<EnclaveAuthProvider>`.

### `<EnclaveAuthProvider>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `publishableKey` | `string` | yes | Application publishable key (`pk_live_…`). Sent as `X-Enclave-Publishable-Key` on every API call. |
| `apiBaseUrl` | `string` | yes | Enclave Auth API base URL (no trailing slash). |
| `theme` | `EnclaveAuthTheme` | no | CSS custom property overrides (see [Theming](#theming)). |
| `fetchImpl` | `typeof fetch` | no | Injectable fetch for tests. |
| `children` | `ReactNode` | yes | Your app tree. |

**Lifecycle:** On mount, calls `initCrypto()` then `POST /application-config`.
While loading, renders `Loading…`. On config failure, renders
`Enclave Auth configuration failed: …` and does not render children.

**Context** (via `useEnclaveAuthContext()`):

| Field | Type | Description |
|-------|------|-------------|
| `api` | `AuthApiClient` | Low-level API client (advanced use). |
| `apiBaseUrl` | `string` | Echo of prop. |
| `publishableKey` | `string` | Echo of prop. |
| `applicationId` | `string \| null` | From `application-config`. |
| `config` | `ApplicationConfig \| null` | `{ applicationId, brandingRemovable }`. |
| `configError` | `string \| null` | Set when config fetch fails. |
| `isReady` | `boolean` | `true` after initial config attempt finishes. |
| `sessionToken` | `string \| null` | Cached session JWT, if any. |
| `isSignedIn` | `boolean` | `true` when `sessionToken` is non-empty. |
| `theme` | `EnclaveAuthTheme` | Merged theme object. |
| `setSession` | `(token: string) => void` | Persist session after sign-in/sign-up (used internally). |
| `signOut` | `() => void` | Clears cached session locally. |
| `shouldShowPoweredBy` | `(appearance?) => boolean` | Footer gating helper. |

### `<SignIn />`

Password or Recovery Key sign-in, plus forgot-password (PIN + new password).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Sign in"` | Panel heading. |
| `subtitle` | `string` | `"Welcome back…"` | Subheading. |
| `appearance` | `{ showPoweredBy?: boolean }` | — | Footer visibility (paid plans only). |
| `onSuccess` | `() => void` | — | Called after a successful sign-in. |

**Renders:** Email + password form, links to Recovery Key mode and forgot-password
flow, optional Powered-by footer.

### `<SignUp />`

Full registration: email verification code → password → Recovery Key display +
confirmation → optional PIN → session mint.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Create your account"` | Panel heading. |
| `appearance` | `{ showPoweredBy?: boolean }` | — | Footer visibility (paid plans only). |
| `onSuccess` | `() => void` | — | Called after registration completes and session is stored. |

### `<UserProfile />`

Signed-in account management: email display, change password, enroll/change PIN,
rotate Recovery Key. **Sessions & devices** section is marked coming soon.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Account"` | Panel heading. |
| `appearance` | `{ showPoweredBy?: boolean }` | — | Footer visibility (paid plans only). |

**Renders:** `null` content guard — if not signed in, shows a message to sign
in first.

Requires a valid cached session (from `<SignIn />` or restored from
`localStorage`).

### `<UserButton />`

Minimal nav control: avatar initial + label, dropdown with **Sign out**.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `"Account"` | Display name; first character becomes avatar letter. |

**Renders:** `null` when not signed in.

### `useAuth()`

Convenience hook — subset of context for app chrome:

```tsx
const { isSignedIn, sessionToken, signOut } = useAuth();
```

| Field | Type | Description |
|-------|------|-------------|
| `isSignedIn` | `boolean` | Whether a session token is cached. |
| `sessionToken` | `string \| null` | Bearer JWT for API calls. |
| `signOut` | `() => void` | Clears local session (does not call a server revoke endpoint). |

**Example — attach token to your API:**

```tsx
const { sessionToken, isSignedIn } = useAuth();

async function loadDashboard() {
  if (!sessionToken) return;
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  // …
}
```

For advanced integrations, `useEnclaveAuthContext()` exposes the full context
including `api`, `config`, and `setSession`.

---

## Theming

Components scope styles under `.enclave-auth`. Override CSS custom properties via
the provider `theme` prop or global CSS targeting `.enclave-auth`.

### Supported variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `--enclave-auth-color-bg` | `#0A0A0A` | Page background |
| `--enclave-auth-color-panel` | `#161616` | Card background |
| `--enclave-auth-color-text` | `#FFFFFF` | Primary text |
| `--enclave-auth-color-text-soft` | `rgba(255,255,255,0.8)` | Secondary text |
| `--enclave-auth-color-muted` | `#8A8A8A` | Muted / labels |
| `--enclave-auth-color-accent` | `#FF6A1F` | Primary buttons / links |
| `--enclave-auth-color-accent-pressed` | `#E55E15` | Button pressed state |
| `--enclave-auth-color-accent-soft` | `rgba(255, 106, 31, 0.25)` | Soft accent fills |
| `--enclave-auth-color-border` | `#8A8A8A` | Borders |
| `--enclave-auth-color-border-soft` | `rgba(255,255,255,0.15)` | Subtle borders |
| `--enclave-auth-color-input-bg` | `rgba(255,255,255,0.08)` | Input background |
| `--enclave-auth-color-danger` | `#f87171` | Errors |
| `--enclave-auth-radius-sm` | `2px` | Corner radius |
| `--enclave-auth-spacing-xs` … `--enclave-auth-spacing-lg` | `4px` … `24px` | Spacing scale |
| `--enclave-auth-font-family` | system UI stack | Body font |
| `--enclave-auth-font-family-display` | `"Roboto Slab", …` | Headings |

### Example — light theme accent

```tsx
<EnclaveAuthProvider
  publishableKey={publishableKey}
  apiBaseUrl={apiBaseUrl}
  theme={{
    "--enclave-auth-color-bg": "#f5f5f5",
    "--enclave-auth-color-panel": "#ffffff",
    "--enclave-auth-color-text": "#111111",
    "--enclave-auth-color-text-soft": "rgba(0,0,0,0.75)",
    "--enclave-auth-color-muted": "#666666",
    "--enclave-auth-color-accent": "#2563eb",
    "--enclave-auth-color-accent-pressed": "#1d4ed8",
    "--enclave-auth-color-accent-soft": "rgba(37, 99, 235, 0.15)",
    "--enclave-auth-color-border": "#cccccc",
    "--enclave-auth-color-border-soft": "rgba(0,0,0,0.12)",
    "--enclave-auth-color-input-bg": "rgba(0,0,0,0.04)",
  }}
>
  <SignIn />
</EnclaveAuthProvider>
```

Default (no `theme` prop): dark background, coral `#FF6A1F` accent — aligned with
Enclave Auth marketing and the developer console.

---

## Origin and publishable key setup

### Where to find values

| Value | Location |
|-------|----------|
| **Publishable key** | [Developer console](https://auth.enclave.talk/dashboard) → your Application → **Authentication** → **API keys** → `publishable` (`pk_live_…`). |
| **Secret key** | Same section, `secret` (`sk_live_…`) — **server-side only**. Never bundle in browser code or commit to git. |
| **Allowed origins** | **Authentication** → **Allowed origins** (one full origin per line, including scheme and port). |
| **API base URL** | Your Enclave Auth Supabase project functions URL, ending in `/functions/v1`. |

### Publishable vs secret key

- **Publishable (`pk_live_…`)** — safe to embed in front-end code. Identifies
  your Application on every `@enclave/auth-react` API call.
- **Secret (`sk_live_…`)** — privileged server-to-server operations only. Do not
  pass to `<EnclaveAuthProvider>`.

If you paste a secret key into `publishableKey`, config and auth calls return
`401 Unauthorized`.

### Common mistakes

1. **Forgot local dev origin** — Vite (`http://localhost:5173`), Next.js
   (`http://localhost:3000`), and Expo web (`http://localhost:8081`) each need
   their exact origin allow-listed, including port.
2. **Trailing slash on `apiBaseUrl`** — stripped internally, but use the form
   `https://….supabase.co/functions/v1` without a trailing `/`.
3. **Empty allowed origins with browser traffic** — if the Application has **no**
   origins saved, any request that includes an `Origin` header is rejected.
4. **Using secret key in the browser** — always `pk_live_…` in
   `publishableKey`.
5. **Missing stylesheet** — UI is unstyled without
   `import "@enclave/auth-react/styles.css"`.

### What errors look like

| Symptom | Likely cause |
|---------|----------------|
| Provider shows `Enclave Auth configuration failed: Unauthorized` | Wrong/revoked publishable key, or browser `Origin` not allow-listed. API body: `{ "error": "Unauthorized" }` with HTTP **401**. |
| Provider stuck on `Loading…` then blank | Check network tab for `/application-config` failures. |
| Sign-in returns generic "Incorrect email or password." | Wrong credentials, or account does not exist (by design — no account enumeration). |
| HTTP **429** on sign-in / sign-up | Rate limited; components show a retry countdown when `Retry-After` is present. |

**Debugging tip:** In DevTools → Network, inspect `POST …/application-config`.
Confirm `X-Enclave-Publishable-Key` is sent and response is `200` with
`applicationId` and `brandingRemovable`. A `401` here means fix key or origins
before debugging sign-in.

---

## License

`@enclave/auth-react` and `@enclave/auth-sdk` are **AGPL-3.0-or-later**.
Network-deployed apps using this UI must comply with AGPL source-offer
requirements unless you hold a separate commercial license from Enclave.
