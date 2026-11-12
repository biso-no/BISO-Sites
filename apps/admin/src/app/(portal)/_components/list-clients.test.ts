import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

// The cases mock the documents and news action modules, and `mock.module` is
// process-wide, so they run in a process of their own.
test("documents and news lists", async () => {
  const child = spawn(
    [process.execPath, "test", join(import.meta.dir, "list-clients.cases.tsx")],
    { cwd: import.meta.dir, stderr: "pipe", stdout: "pipe" }
  );
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`List client cases failed:\n${stdout}\n${stderr}`);
  }
  expect(exitCode).toBe(0);
});
