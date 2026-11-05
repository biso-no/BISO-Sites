import { expect, mock, test } from "bun:test";
import type { EventUpsertInput } from "@repo/shared/types/events";
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

const { EventDescriptionStep } = await import("./event-studio-editor");

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

const values = {
  description_en: "<p>The whole night, in English.</p>",
  description_no: null,
  title_no: "Fadderuke",
} as EventUpsertInput;

function renderEditor(
  locale: "en" | "no",
  changes: [string, string][]
): ReactElement<DescriptionBlockEditorProps> {
  const editor = findElementByType<DescriptionBlockEditorProps>(
    EventDescriptionStep({
      locale,
      onChangeDescriptionEn: (html) => changes.push(["en", html]),
      onChangeDescriptionNo: (html) => changes.push(["no", html]),
      onSuggestRunOfShow: async () => undefined,
      setLocale: () => undefined,
      suggesting: false,
      values,
    }),
    DescriptionBlockEditor
  );
  if (!editor) {
    throw new Error("DescriptionBlockEditor was not rendered");
  }
  return editor;
}

test("the event description step edits the selected locale's HTML in the shared editor", () => {
  const changes: [string, string][] = [];
  const english = renderEditor("en", changes);
  const norwegian = renderEditor("no", changes);

  expect(english.props.value).toBe("<p>The whole night, in English.</p>");
  expect(norwegian.props.value).toBe("");
  expect(english.props.placeholder).toBe(
    "Tell the story. Who's coming? What does the room look like at 8pm?"
  );

  english.props.onChange("<p>Doors at eight.</p>");
  norwegian.props.onChange("<p>Dørene åpner klokka åtte.</p>");

  expect(changes).toEqual([
    ["en", "<p>Doors at eight.</p>"],
    ["no", "<p>Dørene åpner klokka åtte.</p>"],
  ]);
});
