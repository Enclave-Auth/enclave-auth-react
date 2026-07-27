import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { EnclaveAuthProvider } from "../src/context/EnclaveAuthProvider.js";
import {
  HOSTED_AUTH_PATH,
  HOSTED_AUTH_SITE_ORIGIN,
  isHostedAuthSiteLocation,
} from "../src/hosted-auth.js";
import {
  TEST_API_BASE,
  TEST_APP_ID,
  TEST_PUBLISHABLE_KEY,
  createMockFetch,
  jsonResponse,
  routePost,
} from "./helpers/mock-api.js";

vi.mock("@enclave/auth-sdk", () => ({
  initCrypto: vi.fn(async () => {}),
}));

function Child() {
  return <div data-testid="embedded-child">Embedded</div>;
}

function mockBrowserLocation(origin: string, pathname: string) {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      origin,
      pathname,
      href: `${origin}${pathname}`,
      assign,
    },
  });
  return assign;
}

describe("isHostedAuthSiteLocation", () => {
  it("matches production hosted-auth path", () => {
    expect(
      isHostedAuthSiteLocation({
        origin: HOSTED_AUTH_SITE_ORIGIN,
        pathname: HOSTED_AUTH_PATH,
      }),
    ).toBe(true);
  });

  it("does not match embedded paths on the hosted origin", () => {
    expect(
      isHostedAuthSiteLocation({
        origin: HOSTED_AUTH_SITE_ORIGIN,
        pathname: "/login",
      }),
    ).toBe(false);
  });
});

describe("EnclaveAuthProvider hosted fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects when embeddingPermitted is false on a third-party origin", async () => {
    const assign = mockBrowserLocation("https://app.example.com", "/sign-in");

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: TEST_APP_ID,
          brandingRemovable: false,
          embeddingPermitted: false,
          hostedAuthUrl: `${HOSTED_AUTH_SITE_ORIGIN}${HOSTED_AUTH_PATH}?pk=${TEST_PUBLISHABLE_KEY}&mode=sign-in`,
        }),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
        embedMode="sign-in"
      >
        <Child />
      </EnclaveAuthProvider>,
    );

    await waitFor(() => expect(assign).toHaveBeenCalledOnce());
    expect(assign.mock.calls[0]?.[0]).toContain(HOSTED_AUTH_PATH);
    expect(assign.mock.calls[0]?.[0]).toContain(TEST_PUBLISHABLE_KEY);
    expect(screen.queryByTestId("embedded-child")).toBeNull();
    expect(
      screen.getByText("Redirecting to Enclave Auth…"),
    ).toBeInTheDocument();
  });

  it("does not redirect on the hosted-auth page itself", async () => {
    const assign = mockBrowserLocation(
      HOSTED_AUTH_SITE_ORIGIN,
      HOSTED_AUTH_PATH,
    );

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: TEST_APP_ID,
          brandingRemovable: false,
          embeddingPermitted: false,
          hostedAuthUrl: `${HOSTED_AUTH_SITE_ORIGIN}${HOSTED_AUTH_PATH}?pk=${TEST_PUBLISHABLE_KEY}&mode=sign-in`,
        }),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
        enableHostedFallback={false}
      >
        <Child />
      </EnclaveAuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("embedded-child")).toBeInTheDocument(),
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("redirects on 401 origin rejection instead of showing config error", async () => {
    const assign = mockBrowserLocation("https://evil.example.com", "/");

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({ error: "Unauthorized" }, 401),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
        embedMode="sign-up"
      >
        <Child />
      </EnclaveAuthProvider>,
    );

    await waitFor(() => expect(assign).toHaveBeenCalledOnce());
    expect(assign.mock.calls[0]?.[0]).toContain("mode=sign-up");
    expect(
      screen.queryByText(/configuration failed/i),
    ).not.toBeInTheDocument();
  });

  it("renders inline for paid tiers without redirect", async () => {
    const assign = mockBrowserLocation("https://app.example.com", "/sign-in");

    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: TEST_APP_ID,
          brandingRemovable: true,
          embeddingPermitted: true,
        }),
      ),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
      >
        <Child />
      </EnclaveAuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("embedded-child")).toBeInTheDocument(),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
