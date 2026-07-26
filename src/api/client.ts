import type {
  AccountBlobsResponse,
  ApplicationConfig,
  AuthorizePasswordChangeBody,
  AuthorizePasswordChangeResponse,
  ChallengeResponse,
  ForgotPasswordResponse,
  RegisterAccountBody,
  VerifyLoginResponse,
} from "./types.js";

export class AuthApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const asInt = Number.parseInt(header.trim(), 10);
  if (Number.isFinite(asInt) && asInt > 0) return asInt;
  return undefined;
}

export type AuthApiClientOptions = {
  apiBaseUrl: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
};

export function createAuthApiClient(options: AuthApiClientOptions) {
  const base = options.apiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  function headers(sessionToken?: string): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Enclave-Publishable-Key": options.publishableKey,
    };
    if (sessionToken) {
      h.Authorization = `Bearer ${sessionToken}`;
    }
    return h;
  }

  async function postJson<T>(
    path: string,
    body: unknown,
    sessionToken?: string,
  ): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: headers(sessionToken),
      body: JSON.stringify(body),
    });

    let parsed: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { error: text };
      }
    }

    if (!res.ok) {
      const msg =
        typeof parsed === "object" &&
        parsed &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `HTTP ${res.status}`;
      throw new AuthApiError(
        msg,
        res.status,
        parsed,
        parseRetryAfter(res.headers.get("Retry-After")),
      );
    }

    return parsed as T;
  }

  return {
    fetchApplicationConfig(): Promise<ApplicationConfig> {
      return postJson("/application-config", {});
    },
    requestEmailVerification(email: string): Promise<{ ok: boolean }> {
      return postJson("/auth-request-email-verification", { email });
    },
    verifyEmailCode(
      email: string,
      code: string,
    ): Promise<{ verificationToken: string }> {
      return postJson("/auth-verify-email-code", { email, code });
    },
    registerAccount(body: RegisterAccountBody): Promise<{ userId: string }> {
      return postJson("/auth-register", body);
    },
    fetchAccountBlobs(email: string): Promise<AccountBlobsResponse> {
      return postJson("/auth-account-blobs", { email });
    },
    requestLoginChallenge(email: string): Promise<ChallengeResponse> {
      return postJson("/auth-login-challenge", { email });
    },
    verifyLogin(
      challengeId: string,
      signature: string,
      staySignedIn = false,
    ): Promise<VerifyLoginResponse> {
      return postJson("/auth-login-verify", {
        challengeId,
        signature,
        staySignedIn,
      });
    },
    forgotPassword(email: string, pin: string): Promise<ForgotPasswordResponse> {
      return postJson("/auth-forgot-password", { email, pin });
    },
    authorizePasswordChange(
      body: AuthorizePasswordChangeBody,
    ): Promise<AuthorizePasswordChangeResponse> {
      return postJson("/auth-authorize-password-change", body);
    },
    enrollPin(
      body: { verificationHash: unknown; pinUnlock: unknown },
      sessionToken: string,
    ): Promise<{ ok: boolean }> {
      return postJson("/auth-enroll-pin", body, sessionToken);
    },
  };
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;
