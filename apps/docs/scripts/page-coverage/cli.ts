import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "bun";
import {
  findDeadGlobs,
  findMalformed,
  findMissingCoverage,
  findStalePages,
} from "./check";
import { readPages } from "./read-pages";

const MAX_LISTED = 5;

function git(...args: string[]): string {
  const result = spawnSync(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.toString()}`
    );
  }
  return result.stdout.toString();
}

const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function run(): void {
  const flag = process.argv.indexOf("--changed");
  const changedPath = flag === -1 ? undefined : process.argv[flag + 1];
  if (!changedPath) {
    throw new Error("Usage: cli.ts --changed <path-to-newline-list>");
  }
  const changed = lines(readFileSync(changedPath, "utf8"));
  const repoRoot = git("rev-parse", "--show-toplevel").trim();
  const repoFiles = lines(git("-c", "core.quotepath=false", "ls-files"));
  const pages = readPages(repoRoot);

  const out: string[] = [];
  const summary: string[] = [];

  for (const { page, files } of findStalePages(pages, changed)) {
    const shown = files.slice(0, MAX_LISTED).join(", ");
    const more =
      files.length > MAX_LISTED
        ? `, and ${files.length - MAX_LISTED} more`
        : "";
    out.push(
      `::warning file=${page},title=Docs may be out of date::This PR changes code this page describes (${shown}${more}), but not the page. Check it's still accurate.`
    );
    summary.push(`- \`${page}\`: code it describes changed (${shown}${more})`);
  }
  for (const { page, glob } of findDeadGlobs(pages, repoFiles)) {
    out.push(
      `::warning file=${page},title=Coverage glob matches nothing::'${glob}' matches no files. Fix or remove it.`
    );
    summary.push(`- \`${page}\`: glob \`${glob}\` matches no files`);
  }
  for (const page of findMalformed(pages)) {
    out.push(
      `::warning file=${page},title=Invalid covers list::'covers' must be a list of glob strings.`
    );
    summary.push(`- \`${page}\`: \`covers\` is not a list of glob strings`);
  }
  for (const page of findMissingCoverage(pages, changed)) {
    out.push(
      `::warning file=${page},title=Page has no covers list::Add the code paths this page describes, or 'covers: []' if it describes none.`
    );
    summary.push(`- \`${page}\`: no \`covers\` list`);
  }

  for (const line of out) {
    process.stdout.write(`${line}\n`);
  }
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const body =
      summary.length > 0
        ? `## Docs coverage\n\n${summary.join("\n")}\n`
        : "## Docs coverage\n\nNo docs warnings.\n";
    appendFileSync(summaryFile, body);
  }
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `::warning title=Docs coverage check failed::${message.replace(/\n/g, " ")}\n`
  );
}
process.exit(0);
