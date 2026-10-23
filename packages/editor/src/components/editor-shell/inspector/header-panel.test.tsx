import { expect, test } from "bun:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageHeader } from "@/editor/types";
import { emptyHeader } from "@/header/empty-header";
import { HeaderPanel } from "./header-panel";
import { MediaPicker } from "./media-picker";

type AnyEl = ReactElement<{
  children?: ReactNode;
  [key: string]: unknown;
}>;

// Walk the element tree, expanding function components so nested parts show
// (a component's output already holds its children, so they are walked once).
// The media picker uses hooks, so it is listed but not expanded.
const walk = (node: ReactNode, out: AnyEl[] = []): AnyEl[] => {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, out);
    }
    return out;
  }
  if (!isValidElement(node)) {
    return out;
  }
  const el = node as AnyEl;
  out.push(el);
  if (typeof el.type === "function") {
    if (el.type !== MediaPicker) {
      walk((el.type as (p: unknown) => ReactNode)(el.props), out);
    }
    return out;
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

const buttonsLabelled = (tree: ReactNode, label: string) =>
  walk(tree).filter(
    (el) =>
      el.type === "button" &&
      (el.props["aria-label"] === label || text(el.props.children) === label)
  ) as ReactElement<{ disabled?: boolean; onClick: () => void }>[];

const header = (patch: Partial<PageHeader> = {}): PageHeader => ({
  ...emptyHeader("Fadderullan"),
  ...patch,
});

const setup = (h: PageHeader) => {
  const patches: [string, unknown][] = [];
  let removed = 0;
  const tree = HeaderPanel({
    header: h,
    onPatch: (path, value) => patches.push([path, value]),
    onRemove: () => {
      removed += 1;
    },
  });
  return { patches, removed: () => removed, tree };
};

test("choosing Full patches the variant", () => {
  const { patches, tree } = setup(header());
  buttonsLabelled(tree, "Full")[0]?.props.onClick();
  expect(patches).toEqual([["variant", "full"]]);
});

test("the current variant is marked on", () => {
  const html = renderToStaticMarkup(
    <HeaderPanel
      header={header({ variant: "split" })}
      onPatch={() => undefined}
      onRemove={() => undefined}
    />
  );
  expect(html).toContain('<button class="on" type="button">Split</button>');
});

test("Buttons stops at two", () => {
  const two = setup(
    header({
      buttons: [
        { href: "/a", label: "A", style: "primary" },
        { href: "/b", label: "B", style: "secondary" },
      ],
    })
  );
  expect(buttonsLabelled(two.tree, "Add button")[0]?.props.disabled).toBe(true);

  const one = setup(
    header({ buttons: [{ href: "/a", label: "A", style: "primary" }] })
  );
  const add = buttonsLabelled(one.tree, "Add button")[0];
  expect(add?.props.disabled).toBe(false);
  add?.props.onClick();
  expect(one.patches).toEqual([
    [
      "buttons",
      [
        { href: "/a", label: "A", style: "primary" },
        { href: "", label: "", style: "secondary" },
      ],
    ],
  ]);
});

test("a breadcrumb can be added", () => {
  const { patches, tree } = setup(header());
  buttonsLabelled(tree, "Add breadcrumb")[0]?.props.onClick();
  expect(patches).toEqual([["crumbs", [{ href: "", label: "" }]]]);
});

test("a button's style switches between Primary and Secondary", () => {
  const { patches, tree } = setup(
    header({ buttons: [{ href: "/a", label: "A", style: "primary" }] })
  );
  buttonsLabelled(tree, "Secondary")[0]?.props.onClick();
  expect(patches).toEqual([
    ["buttons", [{ href: "/a", label: "A", style: "secondary" }]],
  ]);
});

test("a video offers a poster picker; an image does not", () => {
  const pickers = (h: PageHeader) =>
    walk(setup(h).tree).filter((el) => el.type === MediaPicker);
  expect(
    pickers(header({ media: { kind: "image", src: "https://x.no/a.jpg" } }))
  ).toHaveLength(1);
  const video = pickers(
    header({ media: { kind: "video", src: "https://x.no/v.mp4" } })
  );
  expect(video).toHaveLength(2);
  expect(video[1].props.accept).toBe("image/*");
});

test("an uploaded video file is stored as a video", () => {
  const { patches, tree } = setup(header({ variant: "split" }));
  const [picker] = walk(tree).filter((el) => el.type === MediaPicker) as [
    ReactElement<{
      onPicked: (fileId: string, url: string, mime: string) => void;
    }>,
  ];
  picker.props.onPicked(
    "f-1",
    "https://cloud.appwrite.io/v1/storage/buckets/media/files/f-1/view",
    "video/mp4"
  );
  expect(patches).toEqual([
    [
      "media",
      {
        fileId: "f-1",
        kind: "video",
        src: "https://cloud.appwrite.io/v1/storage/buckets/media/files/f-1/view",
      },
    ],
  ]);
});

test("the alt text shows once there is media and patches media.alt", () => {
  expect(
    walk(setup(header()).tree).some(
      (el) => el.type === "input" && el.props["aria-label"] === "Alt text"
    )
  ).toBe(false);
  const { patches, tree } = setup(
    header({ media: { kind: "image", src: "https://x.no/a.jpg" } })
  );
  const alt = walk(tree).find(
    (el) => el.type === "input" && el.props["aria-label"] === "Alt text"
  ) as ReactElement<{
    onChange: (e: { target: { value: string } }) => void;
  }>;
  alt.props.onChange({ target: { value: "Studenter" } });
  expect(patches).toEqual([["media.alt", "Studenter"]]);
});

test("Remove page header calls onRemove", () => {
  const { removed, tree } = setup(header());
  buttonsLabelled(tree, "Remove page header")[0]?.props.onClick();
  expect(removed()).toBe(1);
});
