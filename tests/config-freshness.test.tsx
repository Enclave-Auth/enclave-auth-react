import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  EnclaveAuthProvider,
  useEnclaveAuthContext,
} from "../src/context/EnclaveAuthProvider.js";
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

function RefreshProbe() {
  const { config, refreshApplicationConfig } = useEnclaveAuthContext();
  return (
    <div>
      <span data-testid="embedding">
        {String(config?.embeddingPermitted ?? "unknown")}
      </span>
      <button type="button" onClick={() => void refreshApplicationConfig()}>
        Refresh config
      </button>
    </div>
  );
}

describe("application-config freshness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("re-fetches embeddingPermitted on refreshApplicationConfig", async () => {
    let callCount = 0;
    const fetchImpl = createMockFetch([
      routePost("/application-config", () => {
        callCount += 1;
        return jsonResponse(
          {
            applicationId: TEST_APP_ID,
            brandingRemovable: callCount > 1,
            embeddingPermitted: callCount > 1,
          },
          200,
          { "Cache-Control": "no-store" },
        );
      }),
    ]);

    render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
        enableHostedFallback={false}
      >
        <RefreshProbe />
      </EnclaveAuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("embedding").textContent).toBe("false"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Refresh config" }));

    await waitFor(() =>
      expect(screen.getByTestId("embedding").textContent).toBe("true"),
    );
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
