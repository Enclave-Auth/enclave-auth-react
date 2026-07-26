import type { ApplicationConfig } from "../src/api/types.js";

export const TEST_APP_ID = "app_test_001";
export const TEST_PUBLISHABLE_KEY = "pk_live_test_key_body";
export const TEST_API_BASE = "https://auth-api.test";

export const defaultConfig: ApplicationConfig = {
  applicationId: TEST_APP_ID,
  brandingRemovable: false,
};

export function configUrl(): string {
  return `${TEST_API_BASE}/application-config`;
}

export type MockRoute = {
  match: (url: string, init?: RequestInit) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
};

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function createMockFetch(routes: MockRoute[]): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    for (const route of routes) {
      if (route.match(url, init)) {
        return route.respond(url, init);
      }
    }
    return jsonResponse({ error: `Unmocked: ${url}` }, 404);
  };
}

export function routePost(
  path: string,
  handler: (body: unknown, init?: RequestInit) => Response | Promise<Response>,
): MockRoute {
  return {
    match(url, init) {
      return url === `${TEST_API_BASE}${path}` && init?.method === "POST";
    },
    respond(_url, init) {
      const raw = init?.body;
      const body =
        typeof raw === "string" && raw ? JSON.parse(raw) : {};
      return handler(body, init);
    },
  };
}
