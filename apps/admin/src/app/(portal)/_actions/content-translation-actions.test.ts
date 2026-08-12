import { expect, test } from "bun:test";
import { join } from "node:path";
import { spawn } from "bun";

const CASE_FILES = [
  "announcements-translation.cases.ts",
  "benefits-translation.cases.ts",
  "events-translation.cases.ts",
  "jobs-translation.cases.ts",
  "news-translation.cases.ts",
  "pages-translation.cases.ts",
  "shop-translation.cases.ts",
  "translate-page-route.cases.ts",
] as const;

for (const caseFile of CASE_FILES) {
  test(`isolated action adapter: ${caseFile}`, async () => {
    const child = spawn(
      [process.execPath, "test", join(import.meta.dir, caseFile)],
      {
        cwd: import.meta.dir,
        stderr: "pipe",
        stdout: "pipe",
      }
    );
    const [exitCode, stderr, stdout] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);

    if (exitCode !== 0) {
      throw new Error(
        `Translation action cases failed in ${caseFile}:\n${stdout}\n${stderr}`
      );
    }
    expect(exitCode).toBe(0);
  });
}
