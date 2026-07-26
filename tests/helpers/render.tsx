import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { EnclaveAuthProvider } from "../../src/context/EnclaveAuthProvider.js";
import type { EnclaveAuthTheme } from "../../src/theme/defaults.js";
import {
  TEST_API_BASE,
  TEST_PUBLISHABLE_KEY,
  createMockFetch,
  defaultConfig,
  jsonResponse,
  routePost,
  type MockRoute,
} from "./mock-api.js";

import "../../src/styles/index.css";

export function renderWithAuth(
  ui: ReactElement,
  options?: {
    routes?: MockRoute[];
    theme?: EnclaveAuthTheme;
    brandingRemovable?: boolean;
    fetchImpl?: typeof fetch;
  } & Omit<RenderOptions, "wrapper">,
) {
  const routes: MockRoute[] = [
    routePost("/application-config", () =>
      jsonResponse({
        ...defaultConfig,
        brandingRemovable: options?.brandingRemovable ?? false,
      }),
    ),
    ...(options?.routes ?? []),
  ];

  const fetchImpl = options?.fetchImpl ?? createMockFetch(routes);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <EnclaveAuthProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        apiBaseUrl={TEST_API_BASE}
        theme={options?.theme}
        fetchImpl={fetchImpl}
      >
        {children}
      </EnclaveAuthProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
