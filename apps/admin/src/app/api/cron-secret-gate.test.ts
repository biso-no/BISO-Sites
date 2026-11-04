import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

// The routes' libraries start with `import "server-only"`, which throws
// outside a Next.js server build.
mock.module("server-only", () => ({}));

const routes = {
  "announcements/dispatch": await import("./announcements/dispatch/route"),
  "it/turnover/stop-retention": await import(
    "./it/turnover/stop-retention/route"
  ),
  "recruitment/publish-scheduled": await import(
    "./recruitment/publish-scheduled/route"
  ),
};

const SECRET = "test-cron-secret";
const saved = {
  cron: process.env.CRON_SECRET,
  stopUrl: process.env.AZURE_RETENTION_STOP_WEBHOOK_URL,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  // Keeps the one accepted path below from reaching Appwrite or Azure.
  Reflect.deleteProperty(process.env, "AZURE_RETENTION_STOP_WEBHOOK_URL");
});

afterEach(() => {
  restore("CRON_SECRET", saved.cron);
  restore("AZURE_RETENTION_STOP_WEBHOOK_URL", saved.stopUrl);
});

const request = (
  headers: Record<string, string> = {},
  url = "http://admin.test/api/cron"
) => new NextRequest(url, { headers, method: "POST" });

// These cases all stop at the gate, before any Appwrite call.
for (const [name, route] of Object.entries(routes)) {
  describe(`/api/${name} cron gate`, () => {
    test("answers 500 when CRON_SECRET is not configured", async () => {
      Reflect.deleteProperty(process.env, "CRON_SECRET");
      const response = await route.POST(
        request({ authorization: `Bearer ${SECRET}` })
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        code: "SECRET_NOT_CONFIGURED",
        error: "CRON_SECRET is not configured",
      });
    });

    test("answers 401 without the secret, with a wrong one, or with it only in the query", async () => {
      for (const attempt of [
        request(),
        request({ authorization: "Bearer wrong-secret" }),
        request({ "x-cron-secret": "wrong-secret" }),
        request({ authorization: `bearer ${SECRET}` }),
        request({ authorization: SECRET }),
        request({}, `http://admin.test/api/cron?secret=${SECRET}`),
      ]) {
        const response = await route.GET(attempt);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          code: "UNAUTHORIZED",
          error: "Unauthorized",
        });
      }
    });
  });
}

describe("/api/it/turnover/stop-retention past the gate", () => {
  test("accepts the secret as a Bearer token or an x-cron-secret header", async () => {
    const route = routes["it/turnover/stop-retention"];
    const accepted: Record<string, string>[] = [
      { authorization: `Bearer ${SECRET}` },
      { "x-cron-secret": SECRET },
    ];
    for (const headers of accepted) {
      const response = await route.POST(request(headers));
      expect(response.status).toBe(500);
      expect((await response.json()).code).toBe("STOP_URL_NOT_CONFIGURED");
    }
  });
});
