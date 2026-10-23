import { expect, test } from "bun:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SECTION_LAYOUT } from "@/editor/sections";
import type { Section, SectionColumns, SectionLayout } from "@/editor/types";
import { SectionPanel } from "./section-panel";

type AnyEl = ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;

// Walk the element tree, expanding function components so nested parts show.
const walk = (node: ReactNode, out: AnyEl[] = []): AnyEl[] => {
  if (!isValidElement(node)) {
    return out;
  }
  const el = node as AnyEl;
  out.push(el);
  if (typeof el.type === "function") {
    walk((el.type as (p: unknown) => ReactNode)(el.props), out);
  }
  for (const child of Children.toArray(el.props.children)) {
    walk(child, out);
  }
  return out;
};

const text = (node: ReactNode): string =>
  Children.toArray(node)
    .map((c) =>
      isValidElement(c) ? text((c as AnyEl).props.children) : String(c)
    )
    .join("");

const buttonLabelled = (tree: ReactNode, label: string) =>
  walk(tree).find(
    (el) =>
      el.type === "button" &&
      (el.props["aria-label"] === label || text(el.props.children) === label)
  ) as ReactElement<{ onClick: () => void }> | undefined;

const section = (
  id: string,
  columns: SectionColumns,
  cols: unknown[][]
): Section => ({
  columns: cols.map((_, i) => ({ blocks: [], id: `${id}-c${i}` })),
  id,
  layout: { ...DEFAULT_SECTION_LAYOUT, columns },
});

const props = (s: Section) => ({
  onAnchor() {
    /* noop */
  },
  onDelete() {
    /* noop */
  },
  onDuplicate() {
    /* noop */
  },
  onLayout() {
    /* noop */
  },
  section: s,
});

test("choosing Tinted patches the background", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({
    ...props(section("s-1", "1-1", [[], []])),
    onLayout: (p) => patches.push(p),
  });
  buttonLabelled(tree, "Tinted")?.props.onClick();
  expect(patches).toEqual([{ background: "tinted" }]);
});

test("two columns offer 'Show column 2 first'; one column offers no reversing", () => {
  expect(
    renderToStaticMarkup(
      <SectionPanel {...props(section("s", "1-1", [[], []]))} />
    )
  ).toContain("Show column 2 first");
  const one = renderToStaticMarkup(
    <SectionPanel {...props(section("s", "1", [[]]))} />
  );
  expect(one).not.toContain("Show column 2 first");
  expect(one).not.toContain("Reverse order on phone");
});

test("three or more columns offer 'Reverse order on phone'", () => {
  expect(
    renderToStaticMarkup(
      <SectionPanel {...props(section("s", "1-1-1", [[], [], []]))} />
    )
  ).toContain("Reverse order on phone");
});

test("four columns can switch to one", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({
    ...props(section("s", "1-1-1-1", [[], [], [], []])),
    onLayout: (p) => patches.push(p),
  });
  buttonLabelled(tree, "One column")?.props.onClick();
  expect(patches).toEqual([{ columns: "1" }]);
});
