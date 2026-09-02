import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

function code(path: string): string {
  return readFileSync(join(root, path), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const list = code("src/components/units/v2/units-v2.tsx");
const listPage = code("src/app/(public)/units/page.tsx");
const reader = code("src/lib/data/campus-landing.ts");
const projectsPage = code("src/app/(public)/projects/page.tsx");

describe("the units index reads the department rows", () => {
  it("does not go through the empty department translation table", () => {
    // `getDepartments()` filters `content_translations` by
    // `content_type = "department"`, and that table holds **zero** department
    // rows — so the page rendered "0 units" and `--` for every stat while 141
    // active departments sat in `departments`.
    expect(listPage).toContain("activeUnits(campus)");
    expect(reader).toContain('"departments"');
    expect(reader).toContain('Query.equal("active", true)');
  });

  it("is the only units index (RD-030)", () => {
    expect(listPage).not.toContain("isShellV2Enabled");
    expect(listPage).not.toContain("<DepartmentsContent");
  });
});

describe("PLACEHOLDER-010 — nothing is rendered that has no source", () => {
  it("offers no type filter", () => {
    // `departments.type` is null on all 280 rows, so the old page's type
    // filter had no values to offer.
    expect(list).not.toContain("availableTypes");
    expect(list).not.toContain("unit.type");
  });

  it("shows no member count", () => {
    // `department_board` holds zero rows, so the old "Active members" tile
    // could only ever read `--`.
    expect(list).not.toContain("boardMembers");
    expect(list).not.toContain("members");
  });

  it("renders no unit imagery or description", () => {
    for (const column of ["logo", "hero", "description"]) {
      expect(list, column).not.toContain(`unit.${column}`);
    }
  });

  it("links a unit only when it has a slug to link to", () => {
    expect(list).toContain("unit.slug");
    expect(list).toContain("unitCanonicalPath");
  });
});

describe("PLACEHOLDER-011 — there are no projects", () => {
  it("restyles the projects chrome without inventing project data", () => {
    // `large_event` holds zero rows. The four projects on the page come from
    // the message bundle and their gradients from constants in the page file.
    expect(projectsPage).not.toContain("isShellV2Enabled");
    expect(projectsPage).toContain("<PageHeader");
    expect(projectsPage).not.toContain("<AboutHero");
  });
});

describe("units message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(root, `../../packages/i18n/messages/${locale}/units.json`),
        "utf8"
      )
    ) as Record<string, unknown>;

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });

  it("is registered as a namespace, or none of it renders", () => {
    for (const locale of ["en", "no"]) {
      const module = readFileSync(
        join(root, `../../packages/i18n/messages/${locale}.ts`),
        "utf8"
      );
      expect(module, locale).toContain(`./${locale}/units.json`);
    }
  });
});
