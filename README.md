# @enclave-technologies/auth-react

Drop-in Enclave Auth sign-in and sign-up UI for React web apps. Renders inline
on the host page — no redirect to Enclave-owned URLs.

## Documentation

**[Integration guide](./docs/integration.md)** — quickstart, core concepts,
component API reference, theming, and origin/key troubleshooting.

## Install

`@enclave-technologies/auth-react` is not on npm yet. Until the first release:

```bash
npm install github:Enclave-Auth/enclave-auth-react#main
```

After publish:

```bash
npm install @enclave-technologies/auth-react
```

Import styles once:

```tsx
import "@enclave-technologies/auth-react/styles.css";
```

## Minimal example

```tsx
import {
  EnclaveAuthProvider,
  SignIn,
  UserButton,
  useAuth,
} from "@enclave-technologies/auth-react";
import "@enclave-technologies/auth-react/styles.css";

export function App() {
  return (
    <EnclaveAuthProvider
      publishableKey="pk_live_…"
      apiBaseUrl="https://your-project.supabase.co/functions/v1"
    >
      <Header />
      <SignIn />
    </EnclaveAuthProvider>
  );
}

function Header() {
  const { isSignedIn } = useAuth();
  return (
    <header>
      {isSignedIn ? <UserButton label="Account" /> : null}
    </header>
  );
}
```

See [docs/integration.md](./docs/integration.md) for a complete Vite quickstart,
env setup, and verification steps.

## Session persistence

Only the **session token** is cached in `localStorage` at
`__enclave_auth_${applicationId}_session`. Identity seeds and AMK material
stay in memory for the duration of an unlock/login operation and are wiped
afterward — this package does not use `enclave-secure-storage`.

## Verify setup

```bash
ENCLAVE_AUTH_PUBLISHABLE_KEY=pk_live_… \
ENCLAVE_AUTH_API_BASE_URL=https://….supabase.co/functions/v1 \
ENCLAVE_AUTH_TEST_ORIGIN=http://localhost:5173 \
node scripts/verify-quickstart.mjs
```

## License

**AGPL-3.0-or-later** — see [`LICENSE`](./LICENSE). Network-deployed apps
using this UI must comply with AGPL source-offer requirements unless you
hold a separate commercial license from Enclave. `@enclave-technologies/auth-sdk` is a
dependency and is also AGPL-3.0-or-later.
