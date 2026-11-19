import { describe, expect, test } from "bun:test";
import { applyAllStep } from "./apply-project-to-all";

describe("apply a project to all receipts", () => {
  test("a click with a project chosen applies it at once", () => {
    expect(applyAllStep(false, { kind: "click", projectId: "k26" })).toEqual({
      apply: true,
      confirmingClear: false,
    });
  });

  test("clearing every receipt takes a second click", () => {
    const first = applyAllStep(false, { kind: "click", projectId: null });
    expect(first).toEqual({ apply: false, confirmingClear: true });
    expect(
      applyAllStep(first.confirmingClear, { kind: "click", projectId: null })
    ).toEqual({ apply: true, confirmingClear: false });
  });

  test("picking a project after the first clear click starts over", () => {
    const first = applyAllStep(false, { kind: "click", projectId: null });
    const picked = applyAllStep(first.confirmingClear, { kind: "pick" });
    // The button reads "apply to all" again, not "click again to clear".
    expect(picked.confirmingClear).toBe(false);
    expect(
      applyAllStep(picked.confirmingClear, { kind: "click", projectId: null })
    ).toEqual({ apply: false, confirmingClear: true });
  });
});
