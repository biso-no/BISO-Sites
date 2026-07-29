import { expect, test } from "bun:test";
import {
  ContentEditor,
  type ContentEditorProps,
} from "@repo/ui/components/content-editor";
import {
  type ElementType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { NewsFormValues } from "../../../_actions/schemas";
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

test("the article step remounts ContentEditor with the selected locale value", () => {
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
  const setValue = () => undefined;

  const norwegianEditor = findElementByType<ContentEditorProps>(
    NewsArticleStep({ locale: "no", setValue, values }),
    ContentEditor
  );
  const englishEditor = findElementByType<ContentEditorProps>(
    NewsArticleStep({ locale: "en", setValue, values }),
    ContentEditor
  );

  if (!(norwegianEditor && englishEditor)) {
    throw new Error("ContentEditor was not rendered");
  }

  expect(norwegianEditor.key).toBe("no");
  expect(norwegianEditor.props.value).toBe("Norsk brødtekst");
  expect(englishEditor.key).toBe("en");
  expect(englishEditor.props.value).toBe("");
  expect(norwegianEditor.key).not.toBe(englishEditor.key);
});
