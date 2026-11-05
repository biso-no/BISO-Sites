import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

// The cases mock the IT user actions module, and `mock.module` is
// process-wide, so they run in a process of their own.
test("IT user detail: confirm-then-run actions", async () => {
  const child = spawn(
    [
      process.execPath,
      "test",
      join(import.meta.dir, "user-detail-actions.cases.tsx"),
    ],
    { cwd: import.meta.dir, stderr: "pipe", stdout: "pipe" }
  );
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`User detail cases failed:\n${stdout}\n${stderr}`);
  }
  expect(exitCode).toBe(0);
});
