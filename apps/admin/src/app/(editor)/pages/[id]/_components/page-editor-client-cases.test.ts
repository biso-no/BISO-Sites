import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

/**
 * `mock.module` is process-global, so the page editor host's cases (which
 * mock the page actions, `sonner`, `next/navigation` and the editor shell)
 * run in their own `bun test` process.
 */
const CASE_FILES = ["page-editor-client.cases.tsx"] as const;

for (const caseFile of CASE_FILES) {
  test(`isolated page editor host cases: ${caseFile}`, async () => {
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
        `Page editor host cases failed in ${caseFile}:\n${stdout}\n${stderr}`
      );
    }
    expect(exitCode).toBe(0);
  });
}
