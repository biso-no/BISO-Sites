import { describe, expect, test } from "bun:test";
import { pageEditorLocks } from "./page-editor-locks";

const base = { campusLocked: false, departmentUser: false, slug: null };

describe("pageEditorLocks", () => {
  test("a sub-page keeps its campus and department; only its name is edited", () => {
    expect(
      pageEditorLocks({ ...base, slug: "units/oslo/fadderullan/program" })
    ).toEqual({ campus: true, department: true, slugUnderUnit: true });
  });

  test("a unit page and a project page are fully held", () => {
    const held = { campus: true, department: true, slug: true };
    expect(
      pageEditorLocks({ ...base, slug: "units/oslo/fadderullan" })
    ).toEqual(held);
    expect(pageEditorLocks({ ...base, slug: "projects/winter-games" })).toEqual(
      held
    );
  });

  test("a department user's new page is held below their unit", () => {
    expect(
      pageEditorLocks({ campusLocked: true, departmentUser: true, slug: null })
    ).toEqual({ campus: true, slugUnderUnit: true });
  });

  test("a department user's older page keeps its address", () => {
    expect(
      pageEditorLocks({
        campusLocked: true,
        departmentUser: true,
        slug: "uten-navn-7",
      })
    ).toEqual({ campus: true, slug: true });
  });

  test("an admin's ordinary page locks only a campus they can't choose", () => {
    expect(pageEditorLocks({ ...base, slug: "about" })).toBeUndefined();
    expect(
      pageEditorLocks({ ...base, campusLocked: true, slug: null })
    ).toEqual({ campus: true });
  });
});
