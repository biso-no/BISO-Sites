import { expect, test } from "bun:test";
import { createGitDateLookup, type GitRunner } from "./git-dates";

const fake = (shallow: string, log: { exitCode: number; stdout: string }) => {
  const calls: string[][] = [];
  const run: GitRunner = (args) => {
    calls.push(args);
    return Promise.resolve(
      args[0] === "rev-parse" ? { exitCode: 0, stdout: shallow } : log
    );
  };
  return { calls, run };
};

test("shallow repo gives null", async () => {
  const { run } = fake("true\n", {
    exitCode: 0,
    stdout: "2026-10-27T10:00:00+01:00",
  });
  expect(await createGitDateLookup(run)("a.mdx")).toBeNull();
});

test("non-zero exit gives null", async () => {
  const { run } = fake("false\n", { exitCode: 128, stdout: "" });
  expect(await createGitDateLookup(run)("a.mdx")).toBeNull();
});

test("garbage output gives null", async () => {
  const { run } = fake("false\n", { exitCode: 0, stdout: "nonsense" });
  expect(await createGitDateLookup(run)("a.mdx")).toBeNull();
});

test("normal output gives the date", async () => {
  const { run } = fake("false\n", {
    exitCode: 0,
    stdout: "2026-10-27T10:00:00+01:00\n",
  });
  expect(await createGitDateLookup(run)("a.mdx")).toEqual(
    new Date("2026-10-27T10:00:00+01:00")
  );
});

test("shallow check runs once", async () => {
  const { run, calls } = fake("false\n", {
    exitCode: 0,
    stdout: "2026-10-27T10:00:00+01:00",
  });
  const lookup = createGitDateLookup(run);
  await Promise.all([lookup("a.mdx"), lookup("b.mdx")]);
  await lookup("c.mdx");
  expect(calls.filter((c) => c[0] === "rev-parse").length).toBe(1);
});
