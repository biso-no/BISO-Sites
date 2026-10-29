import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(import.meta.dir, "..");
const USE_SERVER = /^\s*["']use server["']/;
const SERVER_ONLY_IMPORT = /^import ["']server-only["'];?$/m;

const SERVER_ONLY_MODULES = [
  "lib/team-provisioning.ts",
  "app/(portal)/_actions/audit-log.ts",
] as const;

describe("server helper modules", () => {
  for (const relativePath of SERVER_ONLY_MODULES) {
    const source = readFileSync(join(SRC_ROOT, relativePath), "utf8");

    test(`${relativePath} is not a "use server" module`, () => {
      expect(USE_SERVER.test(source)).toBe(false);
    });

    test(`${relativePath} imports server-only`, () => {
      expect(SERVER_ONLY_IMPORT.test(source)).toBe(true);
    });
  }
});
