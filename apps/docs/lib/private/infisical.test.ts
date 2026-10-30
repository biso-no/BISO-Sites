import { describe, expect, it } from "bun:test";
import { createInfisicalSource, readInfisicalEnv } from "./infisical";
import { PrivateSourceUnavailable } from "./types";

const env = {
  INFISICAL_SITE_URL: "https://infisical.test/",
  INFISICAL_CLIENT_ID: "id",
  INFISICAL_CLIENT_SECRET: "secret",
  INFISICAL_PROJECT_ID: "proj",
  INFISICAL_ENVIRONMENT: "prod",
  INFISICAL_SECRET_PATH: "/docs",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function makeFetch(secretsStatus = 200, expiresIn = 7200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/universal-auth/login")) {
      return Promise.resolve(
        json({ accessToken: "tok", expiresIn, tokenType: "Bearer" })
      );
    }
    return Promise.resolve(
      json({ secrets: [{ secretKey: "A", secretValue: "1" }] }, secretsStatus)
    );
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("createInfisicalSource", () => {
  it("logs in, reads secrets and maps names", async () => {
    const { impl, calls } = makeFetch();
    const source = createInfisicalSource(env, impl);
    expect(await source.get(["A", "B"])).toEqual({ A: "1", B: undefined });
    expect(calls[0]?.url).toBe(
      "https://infisical.test/api/v1/auth/universal-auth/login"
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[1]?.url).toContain("/api/v4/secrets?");
    expect(calls[1]?.url).toContain("projectId=proj");
    expect(calls[1]?.url).toContain("environment=prod");
    expect(calls[1]?.url).toContain("secretPath=%2Fdocs");
    expect(
      (calls[1]?.init?.headers as Record<string, string>).authorization
    ).toBe("Bearer tok");
  });

  it("caches for 5 minutes, then refetches", async () => {
    const { impl, calls } = makeFetch();
    let t = 0;
    const source = createInfisicalSource(env, impl, { now: () => t });
    await source.get(["A"]);
    t = 4 * 60 * 1000;
    await source.get(["A"]);
    expect(calls).toHaveLength(2);
    t = 5 * 60 * 1000 + 1;
    await source.get(["A"]);
    expect(calls).toHaveLength(4);
  });

  it("is unavailable on timeout", async () => {
    const impl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      })) as unknown as typeof fetch;
    const source = createInfisicalSource(env, impl, { timeoutMs: 10 });
    await expect(source.get(["A"])).rejects.toBeInstanceOf(
      PrivateSourceUnavailable
    );
  });

  it("is unavailable on 401", async () => {
    const { impl } = makeFetch(401);
    const source = createInfisicalSource(env, impl);
    await expect(source.get(["A"])).rejects.toBeInstanceOf(
      PrivateSourceUnavailable
    );
  });

  it("is unavailable on a malformed body", async () => {
    const impl = (() =>
      Promise.resolve(json({ nope: true }))) as unknown as typeof fetch;
    const source = createInfisicalSource(env, impl);
    await expect(source.get(["A"])).rejects.toBeInstanceOf(
      PrivateSourceUnavailable
    );
  });

  it("shares one login and fetch between concurrent cold gets", async () => {
    const { impl, calls } = makeFetch();
    const source = createInfisicalSource(env, impl);
    await Promise.all([source.get(["A"]), source.get(["A"])]);
    expect(calls).toHaveLength(2);
  });

  it("logs in again after a short-lived token expires", async () => {
    const { impl, calls } = makeFetch(200, 60);
    let t = 0;
    const source = createInfisicalSource(env, impl, { now: () => t });
    await source.get(["A"]);
    t = 5 * 60 * 1000 + 1;
    await source.get(["A"]);
    const logins = calls.filter((c) => c.url.includes("/universal-auth/login"));
    expect(logins).toHaveLength(2);
  });

  it("only ever logs in or lists secrets", async () => {
    const { impl, calls } = makeFetch();
    const source = createInfisicalSource(env, impl);
    await source.get(["A"]);
    for (const { url, init } of calls) {
      const { pathname } = new URL(url);
      const ok =
        (init?.method === "POST" &&
          pathname === "/api/v1/auth/universal-auth/login") ||
        (init?.method === "GET" && pathname === "/api/v4/secrets");
      expect(ok).toBe(true);
    }
  });
});

describe("readInfisicalEnv", () => {
  it("returns every setting when all are set", () => {
    expect(readInfisicalEnv({ ...env, OTHER: "x" })).toEqual(env);
  });

  it("has no default secret path", () => {
    expect(() =>
      readInfisicalEnv({ ...env, INFISICAL_SECRET_PATH: undefined })
    ).toThrow("INFISICAL_SECRET_PATH");
    expect(() =>
      readInfisicalEnv({ ...env, INFISICAL_SECRET_PATH: "" })
    ).toThrow("INFISICAL_SECRET_PATH");
  });

  it("names every missing setting", () => {
    expect(() => readInfisicalEnv({})).toThrow(
      "INFISICAL_SITE_URL, INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID, INFISICAL_ENVIRONMENT, INFISICAL_SECRET_PATH"
    );
  });
});
