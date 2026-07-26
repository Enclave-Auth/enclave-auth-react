# @enclave/auth-react

Drop-in Enclave Auth sign-in and sign-up UI for React web apps. Renders inline
on the host page — no redirect to Enclave-owned URLs.

## Install

```bash
npm install @enclave/auth-react @enclave/auth-sdk
```

Import styles once in your app:

```tsx
import "@enclave/auth-react/styles.css";
```

## Quick start

```tsx
import {
  EnclaveAuthProvider,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
} from "@enclave/auth-react";

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

## Session persistence

Only the **session token** is cached in `localStorage` at
`__enclave_auth_${applicationId}_session`. Identity seeds and AMK material
stay in memory for the duration of an unlock/login operation and are wiped
afterward — this package does not use `enclave-secure-storage`.

## Theming

Override any CSS custom property on the provider `theme` prop, e.g.
`--enclave-auth-color-accent`. Defaults match Enclave Auth's dark / coral brand.

## Powered by footer

`<SignIn />` and `<SignUp />` render a small "Powered by Enclave Auth" footer
by default. Whether it **can** be hidden is controlled by your Application's
public `application-config` (`brandingRemovable`) — not a unilateral client
override on free plans.

## License

**AGPL-3.0-or-later** — see [`LICENSE`](./LICENSE). Network-deployed apps
using this UI must comply with AGPL source-offer requirements unless you
hold a separate commercial license from Enclave. `@enclave/auth-sdk` is a
dependency and is also AGPL-3.0-or-later.
