import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MediaPlaceholder } from "./media-placeholder";

const TAGS_RE = /<[^>]*>/g;

test("with no label it is a silent box", () => {
  const html = renderToStaticMarkup(<MediaPlaceholder ratio="1/1" />);
  expect(html).toContain("bg-surface-sunken");
  expect(html.replace(TAGS_RE, "")).toBe("");
});

test("with a label the text shows", () => {
  const html = renderToStaticMarkup(
    <MediaPlaceholder label="Add media" ratio="1/1" />
  );
  expect(html).toContain("Add media");
});
