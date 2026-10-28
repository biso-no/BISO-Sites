import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_SESSION_COOKIE, adminSessionCookie } from "./session-cookie";

const REPO_ROOT = join(import.meta.dir, "../../../..");
const readRepoFile = (path: string): string =>
  readFileSync(join(REPO_ROOT, path), "utf8");

test("uses the cookie name the admin reads", () => {
  const instrumentation = readRepoFile("apps/admin/src/instrumentation.ts");
  expect(instrumentation).toContain(
    `const EXPECTED_SESSION_COOKIE = "${ADMIN_SESSION_COOKIE}";`
  );
  expect(readRepoFile("apps/admin/src/lib/auth-utils.ts")).toContain(
    `availableCookies.get("${ADMIN_SESSION_COOKIE}")`
  );
});

test("sets the cookie on the admin's own host, never the production domain", () => {
  const cookie = adminSessionCookie(
    "http://localhost:3001/some/path",
    "secret-value"
  );
  expect(cookie).toEqual({
    httpOnly: true,
    name: ADMIN_SESSION_COOKIE,
    sameSite: "Lax",
    secure: false,
    url: "http://localhost:3001",
    value: "secret-value",
  });
  expect("domain" in cookie).toBe(false);
});

test("marks the cookie secure on https", () => {
  expect(adminSessionCookie("https://127.0.0.1:3443", "s").secure).toBe(true);
});
