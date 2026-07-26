import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { EnclaveAuthProvider } from "../src/context/EnclaveAuthProvider.js";
import {
  TEST_API_BASE,
  TEST_PUBLISHABLE_KEY,
  createMockFetch,
  jsonResponse,
  routePost,
} from "./helpers/mock-api.js";

vi.mock("@enclave/auth-sdk", () => ({
  initCrypto: vi.fn(async () => {}),
}));

describe("theming", () => {
  it("applies CSS custom property overrides on the root", async () => {
    const fetchImpl = createMockFetch([
      routePost("/application-config", () =>
        jsonResponse({
          applicationId: "app_1",
          brandingRemovable: false,
        }),
      ),
    ]);

    const { container } = render(
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        fetchImpl={fetchImpl}
        theme={{ "--enclave-auth-color-accent": "#00FF00" }}
      >
        <span>child</span>
      </EnclaveAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("child")).toBeInTheDocument();
    });

    const root = container.querySelector(".enclave-auth") as HTMLElement;
    expect(root.style.getPropertyValue("--enclave-auth-color-accent")).toBe(
      "#00FF00",
    );
  });
});
