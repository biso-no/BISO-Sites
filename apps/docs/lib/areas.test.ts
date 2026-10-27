import { expect, test } from "bun:test";
import { AREAS, activeArea } from "./areas";

test("guide paths", () =>
  expect(activeArea("/guide/recruitment/publish-a-vacancy")).toBe("guide"));

test("area root", () => expect(activeArea("/developers")).toBe("developers"));

test("lookalike prefix is not an area", () =>
  expect(activeArea("/guidelines")).toBeNull());

test("landing", () => expect(activeArea("/")).toBeNull());

test("the two areas, in order", () => {
  expect(AREAS).toEqual([
    { id: "guide", title: "Platform guide", href: "/guide" },
    { id: "developers", title: "Developers", href: "/developers" },
  ]);
});
