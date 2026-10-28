/**
 * Proves private values never reach the build output.
 *
 * Builds docs with a fake value source holding random sentinels and a fixture
 * page that uses every registry name, then scans `.next` for the sentinels.
 * Exits non-zero on any leak, build failure, or if the fixture was not built.
 *
 * It deletes apps/docs/.next first and overwrites it with a production build,
 * so stop `bun run dev` before running it. Afterwards `.source` may hold a stale
 * fixture entry until the next `fumadocs-mdx` run (check-types or postinstall).
 *
 * Run: bun run check:private-leaks
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRIVATE_VALUES } from "../lib/private/registry";

const APP_DIR = join(import.meta.dirname, "..");
const BUILD_DIR = join(APP_DIR, ".next");
const FIXTURE = join(
  APP_DIR,
  "content",
  "docs",
  "developers",
  "__leak-check.mdx"
);

const FIXTURE_MARKER = "LEAKCHECK-FIXTURE-MARKER";

export interface Leak {
  file: string;
  sentinel: string;
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

/** Scans every file under `dir` (as raw bytes) for any of the sentinels. */
export function findLeaks(dir: string, sentinels: string[]): Leak[] {
  if (!existsSync(dir)) {
    return [];
  }
  const needles = sentinels.map((sentinel) => ({
    sentinel,
    bytes: Buffer.from(sentinel),
  }));
  const leaks: Leak[] = [];
  for (const file of listFiles(dir)) {
    const content = readFileSync(file);
    for (const { sentinel, bytes } of needles) {
      if (content.includes(bytes)) {
        leaks.push({ file, sentinel });
      }
    }
  }
  return leaks;
}

/**
 * Decides the outcome. A check only counts if the fixture really was built, so
 * a missing marker fails even when no sentinel was found.
 */
export function evaluate(
  leaks: Leak[],
  markerFound: boolean
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!markerFound) {
    problems.push(
      "The fixture marker is not in the build output, so the fixture page was not built and the check proves nothing."
    );
  }
  for (const { file } of leaks) {
    problems.push(`A private value was found in ${file}`);
  }
  return { ok: problems.length === 0, problems };
}

function fixtureSource(names: string[]): string {
  const lines = names.map(
    (name) => `- <Private name="${name}" label="${name}" />`
  );
  return [
    "---",
    "title: Leak check fixture",
    "description: Temporary page used by the private leak check.",
    "covers: []",
    "---",
    "",
    FIXTURE_MARKER,
    "",
    ...lines,
    "",
  ].join("\n");
}

function removeFixture(): void {
  rmSync(FIXTURE, { force: true });
}

function run(): number {
  if (existsSync(FIXTURE)) {
    console.error(
      `${FIXTURE} already exists, probably from an interrupted run. Delete it and run again.`
    );
    return 1;
  }
  const names = Object.keys(PRIVATE_VALUES);
  const sentinelByName = new Map(
    names.map((name) => [name, `LEAKCHECK-${randomUUID()}`])
  );
  const tmp = mkdtempSync(join(tmpdir(), "docs-leak-check-"));
  const fakeFile = join(tmp, "values.json");
  writeFileSync(fakeFile, JSON.stringify(Object.fromEntries(sentinelByName)));

  const onSignal = (signal: NodeJS.Signals) => {
    removeFixture();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    writeFileSync(FIXTURE, fixtureSource(names));
    rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log("Building docs with the fake private source...");
    const build = spawnSync("bun", ["run", "build"], {
      cwd: APP_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        DOCS_PRIVATE_SOURCE: "fake",
        DOCS_PRIVATE_FAKE_FILE: fakeFile,
        DOCS_PRIVATE_ALLOW_FAKE: "1",
      },
    });
    if (build.status !== 0) {
      console.error("Build failed, so the leak check could not run.");
      return 1;
    }
    if (!existsSync(BUILD_DIR)) {
      console.error(`No build output at ${BUILD_DIR}.`);
      return 1;
    }

    const nameBySentinel = new Map(
      [...sentinelByName].map(([name, sentinel]) => [sentinel, name])
    );
    const leaks = findLeaks(BUILD_DIR, [...nameBySentinel.keys()]);
    for (const { file, sentinel } of leaks) {
      console.error(
        `LEAK: value of "${nameBySentinel.get(sentinel)}" found in ${file}`
      );
    }
    const markerFound = findLeaks(BUILD_DIR, [FIXTURE_MARKER]).length > 0;
    const { ok, problems } = evaluate(leaks, markerFound);
    if (!ok) {
      for (const problem of problems) {
        console.error(problem);
      }
      return 1;
    }
    console.log(
      `No leaks: ${names.length} sentinels, none found under ${BUILD_DIR}. Fixture marker found, so the fixture was built.`
    );
    return 0;
  } finally {
    removeFixture();
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  process.exit(run());
}
