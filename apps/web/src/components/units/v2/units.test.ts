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
// Main's unit directory. The redesign's own `campus-landing.ts` reader fixed
// the same "0 units" bug independently and was retired in its favour.
const reader = code("src/lib/data/units.ts");
const projectsPage = code("src/app/(public)/projects/page.tsx");

describe("the units index reads the department rows", () => {
  it("does not go through the empty department translation table", () => {
    // `getDepartments()` filters `content_translations` by
    // `content_type = "department"`, and that table holds **zero** department
    // rows — so the page rendered "0 units" and `--` for every stat while 141
    // active departments sat in `departments`.
    expect(listPage).toContain("cachedPublicUnits(locale)");
    expect(reader).toContain('"departments"');
    expect(reader).toContain('Query.equal("active", true)');
    // `active` is not a publication flag: the public-visibility rule is the
    // second half of the filter, applied once in the reader.
    expect(reader).toContain(".filter(isPublicUnit)");
  });

  it("tells a failed read apart from an empty directory", () => {
    // #77: a read that failed renders "unavailable", never "0 units".
    expect(listPage).toContain(".catch(() => null)");
    expect(list).toContain("units === null");
  });

  it("is the only units index (RD-030)", () => {
    expect(listPage).not.toContain("isShellV2Enabled");
    expect(listPage).not.toContain("<DepartmentsContent");
  });
});

describe("PLACEHOLDER-010 — nothing is rendered that has no source", () => {
  it("derives the category filter from the data, never a static list", () => {
    // `departments.type` was null on all 280 rows when this page was rebuilt,
    // which is why it shipped without a type filter. The admin unit-profile
    // editor gave the column a writer, so the filter is back — but its options
    // come from the values the loaded units actually carry, and `<FilterChips>`
    // drops a row left with only "All". Nothing renders while the column is
    // empty, and no chip is ever offered that returns nothing.
    expect(list).not.toContain("availableTypes");
    expect(list).toContain("presentCategories");
    expect(list).toContain("UNIT_CATEGORIES.filter");
    // The reader normalises the free-text column once; the list reads that.
    expect(reader).toContain("parseUnitCategory(department.type)");
    expect(list).toContain("unit.category");
  });

  it("shows no member count", () => {
    // `department_board` holds zero rows, so the old "Active members" tile
    // could only ever read `--`.
    expect(list).not.toContain("boardMembers");
    expect(list).not.toContain("members");
  });

  it("renders unit imagery only through the shared card", () => {
    // Units have started uploading logos (main #87), and `UnitCard` →
    // `UnitCrest` owns them, falling back to the name-derived monogram. The
    // list itself reads no image or description column.
    expect(list).toContain("<UnitCard");
    for (const column of ["logo", "hero", "description"]) {
      expect(list, column).not.toContain(`unit.${column}`);
    }
  });

  it("links every unit to a page that exists", () => {
    // A unit without a slug still has a page at its legacy `/units/<id>` URL
    // (`cachedUnitDetail` is keyed on the row id), so the reader builds the
    // canonical path where it can and falls back to that one.
    expect(reader).toContain("unitCanonicalPath");
    // Joined so the source holds no literal `${` (noTemplateCurlyInString).
    expect(reader).toContain(["`/units/", "{department.$id}`"].join("$"));
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
