import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

/**
 * `mock.module` is process-global, and many admin tests mock
 * `@repo/api/server` differently, so the inline-media route's chunk cases
 * run in their own `bun test` process.
 */
const CASE_FILES = ["route.cases.ts"] as const;

for (const caseFile of CASE_FILES) {
  test(`isolated inline-media route cases: ${caseFile}`, async () => {
    const child = spawn(
      [process.execPath, "test", join(import.meta.dir, caseFile)],
      { cwd: import.meta.dir, stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stderr, stdout] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);
    if (exitCode !== 0) {
      throw new Error(
        `Inline-media route cases failed in ${caseFile}:\n${stdout}\n${stderr}`
      );
    }
    expect(exitCode).toBe(0);
  });
}
