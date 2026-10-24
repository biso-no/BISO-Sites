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
import { MediaPicker } from "./media-picker";
import { LinkNameField, SectionPanel } from "./section-panel";

type AnyEl = ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;

// Walk the element tree, expanding function components so nested parts show.
// The media picker and the link name field use hooks, so they are listed but
// not expanded (the field's behaviour is in section-panel.dom.test.tsx).
const walk = (node: ReactNode, out: AnyEl[] = []): AnyEl[] => {
  if (!isValidElement(node)) {
    return out;
  }
  const el = node as AnyEl;
  out.push(el);
  if (
    typeof el.type === "function" &&
    el.type !== MediaPicker &&
    el.type !== LinkNameField
  ) {
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

type LinkNameElement = ReactElement<Parameters<typeof LinkNameField>[0]> & {
  key: string | null;
};

const linkNameField = (tree: ReactNode) =>
  walk(tree).find((el) => el.type === LinkNameField) as
    | LinkNameElement
    | undefined;

test("the link name field shows the section's name, commits through onAnchor, and is keyed by section", () => {
  const onAnchor = (_anchor: string) => undefined;
  const field = linkNameField(
    SectionPanel({
      ...props({ ...section("s", "1", [[]]), anchor: "intro" }),
      onAnchor,
    })
  );
  expect(field?.props.anchor).toBe("intro");
  expect(field?.props.onAnchor).toBe(onAnchor);
  // Children.toArray (in the walk) prefixes the key with ".$".
  expect(field?.key).toBe(".$s");
  expect(
    linkNameField(SectionPanel(props(section("t", "1", [[]]))))?.props.anchor
  ).toBe("");
});

const photoSection = (backgroundImage?: SectionLayout["backgroundImage"]) => {
  const s = section("s", "1", [[]]);
  return {
    ...s,
    layout: { ...s.layout, background: "photo" as const, backgroundImage },
  };
};

type PickerProps = Parameters<typeof MediaPicker>[0];
const pickerIn = (tree: ReactNode) =>
  walk(tree).find((el) => el.type === MediaPicker) as
    | ReactElement<PickerProps>
    | undefined;

const altInput = (tree: ReactNode) =>
  walk(tree).find(
    (el) => el.type === "input" && el.props["aria-label"] === "Alt text"
  ) as
    | ReactElement<{
        onChange: (e: { target: { value: string } }) => void;
        value: string;
      }>
    | undefined;

test("choosing Photo patches the background", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({
    ...props(section("s-1", "1", [[]])),
    onLayout: (p) => patches.push(p),
  });
  buttonLabelled(tree, "Photo")?.props.onClick();
  expect(patches).toEqual([{ background: "photo" }]);
});

test("only a Photo section asks for a background image", () => {
  const plain = renderToStaticMarkup(
    <SectionPanel {...props(section("s", "1", [[]]))} />
  );
  expect(plain).not.toContain("Background image");
  const photo = renderToStaticMarkup(
    <SectionPanel {...props(photoSection())} />
  );
  expect(photo).toContain("Background image");
  expect(photo).toContain('accept="image/*"');
});

test("an uploaded or linked image patches backgroundImage, keeping the alt text", () => {
  const patches: Partial<SectionLayout>[] = [];
  const tree = SectionPanel({
    ...props(photoSection({ alt: "Storefjell", src: "https://old/a.jpg" })),
    onLayout: (p) => patches.push(p),
  });
  const picker = pickerIn(tree);
  expect(picker?.props.accept).toBe("image/*");
  expect(picker?.props.src).toBe("https://old/a.jpg");
  picker?.props.onPicked("f-9", "https://cdn/b.jpg", "image/jpeg");
  picker?.props.onUrl("https://elsewhere/c.jpg");
  picker?.props.onClear?.();
  expect(patches).toEqual([
    {
      backgroundImage: {
        alt: "Storefjell",
        fileId: "f-9",
        mime: "image/jpeg",
        src: "https://cdn/b.jpg",
      },
    },
    { backgroundImage: { alt: "Storefjell", src: "https://elsewhere/c.jpg" } },
    { backgroundImage: undefined },
  ]);
});

test("the alt text field edits the image's alt", () => {
  expect(altInput(SectionPanel(props(photoSection())))).toBeUndefined();
  const patches: Partial<SectionLayout>[] = [];
  const input = altInput(
    SectionPanel({
      ...props(photoSection({ fileId: "f-1", src: "https://cdn/a.jpg" })),
      onLayout: (p) => patches.push(p),
    })
  );
  expect(input?.props.value).toBe("");
  input?.props.onChange({ target: { value: "Fadderne på toppen" } });
  expect(patches).toEqual([
    {
      backgroundImage: {
        alt: "Fadderne på toppen",
        fileId: "f-1",
        src: "https://cdn/a.jpg",
      },
    },
  ]);
});
