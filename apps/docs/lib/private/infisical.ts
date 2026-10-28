import { z } from "zod";
import {
  type PrivateEnv,
  PrivateSourceUnavailable,
  type PrivateValueSource,
} from "./types";

const CACHE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;
const MS_PER_SECOND = 1000;
const TRAILING_SLASHES = /\/+$/;

// POST /api/v1/auth/universal-auth/login
const loginSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().optional(),
});

// GET /api/v4/secrets
const secretsSchema = z.object({
  secrets: z.array(
    z.object({ secretKey: z.string(), secretValue: z.string().optional() })
  ),
});

export const INFISICAL_ENV_VARS = [
  "INFISICAL_SITE_URL",
  "INFISICAL_CLIENT_ID",
  "INFISICAL_CLIENT_SECRET",
  "INFISICAL_PROJECT_ID",
  "INFISICAL_ENVIRONMENT",
  "INFISICAL_SECRET_PATH",
] as const;

/**
 * Every Infisical setting, all required. There are no defaults: in particular
 * no secret path, so a missing `INFISICAL_SECRET_PATH` can't silently read the
 * project root.
 */
export type InfisicalEnv = Record<(typeof INFISICAL_ENV_VARS)[number], string>;

/** Picks the Infisical settings out of `env`, naming any that are missing. */
export function readInfisicalEnv(env: PrivateEnv): InfisicalEnv {
  const config: Partial<InfisicalEnv> = {};
  const missing: string[] = [];
  for (const name of INFISICAL_ENV_VARS) {
    const value = env[name];
    if (value) {
      config[name] = value;
    } else {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `DOCS_PRIVATE_SOURCE=infisical requires: ${missing.join(", ")}`
    );
  }
  return config as InfisicalEnv;
}

export interface InfisicalOptions {
  now?: () => number;
  timeoutMs?: number;
}

export function createInfisicalSource(
  env: InfisicalEnv,
  fetchImpl: typeof fetch = fetch,
  { now = Date.now, timeoutMs = REQUEST_TIMEOUT_MS }: InfisicalOptions = {}
): PrivateValueSource {
  let token: { value: string; expires: number } | null = null;
  let values: { map: Map<string, string>; expires: number } | null = null;

  const base = env.INFISICAL_SITE_URL.replace(TRAILING_SLASHES, "");

  async function request(url: string, init: RequestInit): Promise<unknown> {
    const res = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new PrivateSourceUnavailable();
    }
    return res.json();
  }

  async function login(): Promise<string> {
    if (token && token.expires > now()) {
      return token.value;
    }
    const body = loginSchema.parse(
      await request(`${base}/api/v1/auth/universal-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: env.INFISICAL_CLIENT_ID,
          clientSecret: env.INFISICAL_CLIENT_SECRET,
        }),
      })
    );
    const ttl = Math.min(
      CACHE_MS,
      body.expiresIn ? body.expiresIn * MS_PER_SECOND : CACHE_MS
    );
    token = { value: body.accessToken, expires: now() + ttl };
    return body.accessToken;
  }

  let inflight: Promise<Map<string, string>> | null = null;

  function load(): Promise<Map<string, string>> {
    if (values && values.expires > now()) {
      return Promise.resolve(values.map);
    }
    inflight ??= fetchAll().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function fetchAll(): Promise<Map<string, string>> {
    const accessToken = await login();
    const query = new URLSearchParams({
      projectId: env.INFISICAL_PROJECT_ID,
      environment: env.INFISICAL_ENVIRONMENT,
      secretPath: env.INFISICAL_SECRET_PATH,
      viewSecretValue: "true",
      expandSecretReferences: "true",
      includeImports: "false",
    });
    const body = secretsSchema.parse(
      await request(`${base}/api/v4/secrets?${query}`, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}` },
      })
    );
    const map = new Map<string, string>();
    for (const secret of body.secrets) {
      if (secret.secretValue !== undefined) {
        map.set(secret.secretKey, secret.secretValue);
      }
    }
    values = { map, expires: now() + CACHE_MS };
    return map;
  }

  return {
    async get(names) {
      let map: Map<string, string>;
      try {
        map = await load();
      } catch {
        token = null;
        throw new PrivateSourceUnavailable();
      }
      const out: Record<string, string | undefined> = {};
      for (const name of names) {
        out[name] = map.get(name);
      }
      return out;
    },
  };
}
