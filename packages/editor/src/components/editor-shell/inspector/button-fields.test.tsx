import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ButtonFields } from "./button-fields";

const html = (href: string) =>
  renderToStaticMarkup(
    <ButtonFields
      button={{ href, label: "Go", style: "primary" }}
      onChange={() => undefined}
    />
  );

describe("ButtonFields", () => {
  test("an empty link shows the no-link note", () => {
    expect(html("")).toContain("No link yet");
  });

  test("a valid link shows no note", () => {
    expect(html("/om-oss")).not.toContain("pe-insp-note");
  });

  test("an unsafe link says it isn't allowed", () => {
    const out = html("javascript:x");
    expect(out).toContain("isn&#x27;t allowed");
    expect(out).not.toContain("No link yet");
  });
});
