#!/usr/bin/env node
/**
 * Verifies quickstart prerequisites against a live Enclave Auth API.
 *
 * Usage (recommended):
 *   ENCLAVE_AUTH_API_BASE_URL=https://….supabase.co/functions/v1 \
 *   ENCLAVE_AUTH_PUBLISHABLE_KEY=pk_live_… \
 *   ENCLAVE_AUTH_TEST_ORIGIN=http://localhost:5173 \
 *   node scripts/verify-quickstart.mjs
 *
 * When ENCLAVE_AUTH_PUBLISHABLE_KEY is unset, attempts to read the
 * "Enclave Auth Platform" key via `supabase db query --linked` from
 * ../enclave-auth-api (Enclave maintainer machines only).
 */

import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const apiBase = (
  process.env.ENCLAVE_AUTH_API_BASE_URL ??
  "https://osaeeaarqihtsxcrmxyk.supabase.co/functions/v1"
).replace(/\/+$/, "");

const testOrigin =
  process.env.ENCLAVE_AUTH_TEST_ORIGIN ?? "http://localhost:8081";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`OK: ${message}`);
}

async function postConfig(publishableKey, origin) {
  if (origin) {
    return postConfigWithCurl(publishableKey, origin);
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Enclave-Publishable-Key": publishableKey,
  };

  const res = await fetch(`${apiBase}/application-config`, {
    method: "POST",
    headers,
    body: "{}",
  });

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  return { status: res.status, body };
}

/** Node fetch cannot set Origin (forbidden header); use curl for browser-origin checks. */
function postConfigWithCurl(publishableKey, origin) {
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const result = spawnSync(
    curlBin,
    [
      "-s",
      "-X",
      "POST",
      `${apiBase}/application-config`,
      "-H",
      "Content-Type: application/json",
      "-H",
      `X-Enclave-Publishable-Key: ${publishableKey}`,
      "-H",
      `Origin: ${origin}`,
      "-d",
      "{}",
      "-w",
      "__HTTP_STATUS__:%{http_code}",
    ],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw result.error;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  const marker = "__HTTP_STATUS__:";
  const statusIndex = output.lastIndexOf(marker);
  const status = Number.parseInt(
    output.slice(statusIndex + marker.length).trim(),
    10,
  );
  const bodyText = output.slice(0, statusIndex).trim();

  let body = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = { error: bodyText };
    }
  }

  return { status, body };
}

function resolvePublishableKeyFromSupabase() {
  const authApiDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "enclave-auth-api",
  );
  const sql =
    "select k.key_value from public.application_api_keys k " +
    "join public.applications a on a.id = k.application_id " +
    "where a.name = 'Enclave Auth Platform' and k.key_type = 'publishable' " +
    "and k.revoked_at is null limit 1;";

  let raw = "";
  try {
    raw = execSync(`npx supabase db query --linked ${JSON.stringify(sql)}`, {
      cwd: authApiDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    const stdout =
      err && typeof err === "object" && "stdout" in err
        ? String(err.stdout)
        : "";
    raw = stdout;
    if (!raw) throw err;
  }

  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const value = parsed?.rows?.[0]?.key_value;
      if (typeof value === "string" && value.startsWith("pk_live_")) {
        return value;
      }
    } catch {
      /* fall through to regex */
    }
  }

  const match = raw.match(/"key_value":\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

async function main() {
  let publishableKey = process.env.ENCLAVE_AUTH_PUBLISHABLE_KEY?.trim() ?? "";

  if (!publishableKey) {
    try {
      publishableKey = resolvePublishableKeyFromSupabase() ?? "";
    } catch {
      /* maintainer-only fallback */
    }
  }

  if (!publishableKey.startsWith("pk_live_")) {
    fail(
      "Set ENCLAVE_AUTH_PUBLISHABLE_KEY (pk_live_…) or run from a linked enclave-auth-api checkout.",
    );
  }

  const invalid = await postConfig("pk_live_invalid_test_key", testOrigin);
  if (invalid.status !== 401 || invalid.body?.error !== "Unauthorized") {
    fail(`invalid key should return 401 Unauthorized, got ${invalid.status}`);
  }
  pass("invalid publishable key returns 401 Unauthorized");

  const wrongOrigin = await postConfig(
    publishableKey,
    "http://localhost:5173",
  );
  if (wrongOrigin.status !== 401 || wrongOrigin.body?.error !== "Unauthorized") {
    fail(`disallowed origin should return 401 Unauthorized, got ${wrongOrigin.status}`);
  }
  pass("disallowed browser Origin returns 401 Unauthorized");

  const ok = await postConfig(publishableKey, testOrigin);
  if (ok.status !== 200) {
    fail(
      `application-config failed (${ok.status}): ${JSON.stringify(ok.body)} — add ${testOrigin} to allowed origins in the dev console`,
    );
  }

  if (typeof ok.body?.applicationId !== "string" || !ok.body.applicationId) {
    fail("application-config response missing applicationId");
  }

  if (typeof ok.body?.brandingRemovable !== "boolean") {
    fail("application-config response missing brandingRemovable boolean");
  }

  pass(
    `application-config OK (applicationId present, brandingRemovable=${ok.body.brandingRemovable})`,
  );
  pass(`apiBaseUrl=${apiBase}`);
  pass(`testOrigin=${testOrigin}`);
}

await main();
