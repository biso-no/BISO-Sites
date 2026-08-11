import { expect, test } from "bun:test";
import { isValidElement, type ReactNode } from "react";
import type { NewsFormValues } from "../../../_actions/schemas";
import { NewsStudioPreview } from "./news-studio-preview";

const collectText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join("");
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return "";
  }
  return collectText(node.props.children);
};

const values: NewsFormValues = {
  author: null,
  campus_id: "campus-oslo",
  category: null,
  department_id: null,
  description_en: "",
  description_no: "",
  image: "",
  slug: "student-news",
  status: "draft",
  sticky: false,
  title_en: "English title",
  title_no: "Norsk tittel",
};

test("the preview renders a stable localized timestamp", () => {
  const previewTimestamp = "2020-02-03T12:00:00.000Z";
  const baseProps = {
    campusName: "Oslo",
    departmentName: "All departments",
    previewTimestamp,
    values,
  };

  const norwegian = NewsStudioPreview({ ...baseProps, locale: "no" });
  const english = NewsStudioPreview({ ...baseProps, locale: "en" });

  expect(collectText(norwegian)).toContain("BISO · 03.02.2020");
  expect(collectText(english)).toContain("BISO · 03/02/2020");
});
