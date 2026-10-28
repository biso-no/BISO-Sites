import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PREPARE_NAMES, SHOTS } from "./manifest";

const REPO_ROOT = join(import.meta.dir, "../../../..");
const URL_SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STEP_TITLE = /<Step\s+title="([^"]+)"/g;
const HEADING = /^#{1,6}\s+(.+?)\s*$/gm;
const GUIDE_PAGE = /^apps\/docs\/content\/docs\/.+\.mdx$/;
const NEEDED_SCREENS: [string, RegExp][] = [
  ["jobs list", /^\/jobs $/],
  ["vacancy editor", /^\/jobs\/[^/?]+ $/],
  ["pipeline", /^\/jobs\/[^/]+\/applications $/],
  ["candidate drawer", /\/applications\?candidate=/],
  ["schedule dialog", /open-schedule$/],
  ["booking link", /show-booking-link$/],
  ["scorecard", /open-scorecard$/],
  ["sign-in page", /^\/auth\/login /],
];

function stepsAndHeadings(page: string): Set<string> {
  const source = readFileSync(join(REPO_ROOT, page), "utf8");
  return new Set([
    ...Array.from(source.matchAll(STEP_TITLE), (match) => match[1]),
    ...Array.from(source.matchAll(HEADING), (match) => match[1]),
  ]);
}

test("there are shots", () => {
  expect(SHOTS.length).toBeGreaterThan(0);
});

test("ids are unique and URL-safe", () => {
  const ids = SHOTS.map((shot) => shot.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(id).toMatch(URL_SAFE_ID);
  }
});

test("every page file exists", () => {
  for (const shot of SHOTS) {
    expect(shot.page).toMatch(GUIDE_PAGE);
    expect(existsSync(join(REPO_ROOT, shot.page))).toBe(true);
  }
});

test("every afterStep is a Step title or a heading in its page", () => {
  for (const shot of SHOTS) {
    const anchors = stepsAndHeadings(shot.page);
    if (!anchors.has(shot.afterStep)) {
      throw new Error(
        `${shot.id}: "${shot.afterStep}" is not a <Step title> or heading in ${shot.page}`
      );
    }
  }
});

test("width and height are positive whole numbers", () => {
  for (const shot of SHOTS) {
    expect(Number.isInteger(shot.width)).toBe(true);
    expect(Number.isInteger(shot.height)).toBe(true);
    expect(shot.width).toBeGreaterThan(0);
    expect(shot.height).toBeGreaterThan(0);
  }
});

test("routes are admin paths and prepares are known", () => {
  for (const shot of SHOTS) {
    expect(shot.route.startsWith("/")).toBe(true);
    expect(shot.route.startsWith("//")).toBe(false);
    if (shot.prepare !== undefined) {
      expect(PREPARE_NAMES).toContain(shot.prepare);
    }
    expect(shot.caption.trim().length).toBeGreaterThan(0);
  }
});

test("covers the screens the recruitment guide needs", () => {
  const routes = SHOTS.map((shot) => `${shot.route} ${shot.prepare ?? ""}`);
  for (const [screen, pattern] of NEEDED_SCREENS) {
    const covered = routes.some((route) => pattern.test(route));
    if (!covered) {
      throw new Error(`No shot covers the ${screen}`);
    }
  }
});

test("only the sign-in shot runs signed out", () => {
  for (const shot of SHOTS) {
    expect(Boolean(shot.signedOut)).toBe(shot.route.startsWith("/auth/"));
  }
});
