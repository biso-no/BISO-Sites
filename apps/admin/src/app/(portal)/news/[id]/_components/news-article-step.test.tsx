import { expect, test } from "bun:test";
import {
  type ElementType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { NewsFormValues } from "../../../_actions/schemas";
import {
  DescriptionBlockEditor,
  type DescriptionBlockEditorProps,
} from "../../../_components/description-block-editor";
import { NewsArticleStep } from "./news-article-step";

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

test("the article step renders the shared editor with the selected locale value", () => {
  const values: NewsFormValues = {
    author: null,
    campus_id: "campus-oslo",
    category: null,
    department_id: null,
    description_en: "",
    description_no: "Norsk brødtekst",
    image: "",
    slug: "student-news",
    status: "draft",
    sticky: false,
    title_en: "",
    title_no: "Norsk tittel",
  };
  const updates: [
    keyof NewsFormValues,
    NewsFormValues[keyof NewsFormValues],
  ][] = [];
  const setValue = <Key extends keyof NewsFormValues>(
    key: Key,
    value: NewsFormValues[Key]
  ) => {
    updates.push([key, value]);
  };

  const norwegianEditor = findElementByType<DescriptionBlockEditorProps>(
    NewsArticleStep({ locale: "no", setValue, values }),
    DescriptionBlockEditor
  );
  const englishEditor = findElementByType<DescriptionBlockEditorProps>(
    NewsArticleStep({ locale: "en", setValue, values }),
    DescriptionBlockEditor
  );

  if (!(norwegianEditor && englishEditor)) {
    throw new Error("DescriptionBlockEditor was not rendered");
  }

  expect(norwegianEditor.key).toBe("no");
  expect(norwegianEditor.props.value).toBe("Norsk brødtekst");
  expect(englishEditor.key).toBe("en");
  expect(englishEditor.props.value).toBe("");
  expect(norwegianEditor.props.placeholder).toBe(
    "Write the norwegian article here..."
  );
  expect(englishEditor.props.placeholder).toBe(
    "Write the english article here..."
  );
  expect(norwegianEditor.key).not.toBe(englishEditor.key);

  norwegianEditor.props.onChange("Oppdatert norsk brødtekst");
  englishEditor.props.onChange("Updated English article");

  expect(updates).toEqual([
    ["description_no", "Oppdatert norsk brødtekst"],
    ["description_en", "Updated English article"],
  ]);
});
