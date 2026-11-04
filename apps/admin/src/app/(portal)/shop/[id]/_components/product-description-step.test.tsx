import { expect, mock, test } from "bun:test";
import {
  type ElementType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  DescriptionBlockEditor,
  type DescriptionBlockEditorProps,
} from "../../../_components/description-block-editor";

// The studio module reaches server actions that start with
// `import "server-only"`, which throws outside a Next.js server build.
mock.module("server-only", () => ({}));

const { ProductDescriptionStep } = await import("./shop-studio-editor");

const findElementByType = <Props,>(
  node: ReactNode,
  type: ElementType
): ReactElement<Props> | null => {
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return null;
  }
  if (node.type === type) {
    return node as ReactElement<Props>;
  }
  const { children } = node.props;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByType<Props>(child, type);
      if (match) {
        return match;
      }
    }
    return null;
  }
  return findElementByType<Props>(children, type);
};

function renderEditor(
  lang: "en" | "no",
  changes: [string, string][]
): ReactElement<DescriptionBlockEditorProps> {
  const editor = findElementByType<DescriptionBlockEditorProps>(
    ProductDescriptionStep({
      descriptionEn: "<p>Soft hoodie.</p>",
      descriptionNo: "<p>Myk hettegenser.</p>",
      lang,
      onLangChange: () => undefined,
      setDescriptionEn: (html) => changes.push(["en", html]),
      setDescriptionNo: (html) => changes.push(["no", html]),
    }),
    DescriptionBlockEditor
  );
  if (!editor) {
    throw new Error("DescriptionBlockEditor was not rendered");
  }
  return editor;
}

test("the product description step edits the selected locale's HTML in the shared editor", () => {
  const changes: [string, string][] = [];
  const english = renderEditor("en", changes);
  const norwegian = renderEditor("no", changes);

  expect(english.props.value).toBe("<p>Soft hoodie.</p>");
  expect(norwegian.props.value).toBe("<p>Myk hettegenser.</p>");
  expect(norwegian.props.placeholder).toBe(
    "Write something about this product…"
  );

  english.props.onChange("<h3>Sizes</h3><ul><li>S</li><li>M</li></ul>");
  norwegian.props.onChange("<p>Brodert logo.</p>");

  expect(changes).toEqual([
    ["en", "<h3>Sizes</h3><ul><li>S</li><li>M</li></ul>"],
    ["no", "<p>Brodert logo.</p>"],
  ]);
});
