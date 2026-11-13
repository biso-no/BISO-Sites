import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ADMIN_SESSION_COOKIE } from "./session-cookie";

const SRC = join(import.meta.dir, "..");
const SOURCE_FILE = /\.tsx?$/;
const SESSION_COOKIE_LITERAL = /["'`]biso_\w*session\w*["'`]/;
const OWNERS = new Set(["lib/session-cookie.ts", "lib/session-cookie.test.ts"]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (SOURCE_FILE.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

test("the admin session cookie is biso_session_admin", () => {
  expect(ADMIN_SESSION_COOKIE).toBe("biso_session_admin");
});

test("only session-cookie.ts names the session cookie", () => {
  const offenders = sourceFiles(SRC)
    .map((path) => relative(SRC, path))
    .filter((path) => !OWNERS.has(path))
    .filter((path) =>
      SESSION_COOKIE_LITERAL.test(readFileSync(join(SRC, path), "utf8"))
    );
  expect(offenders).toEqual([]);
});
