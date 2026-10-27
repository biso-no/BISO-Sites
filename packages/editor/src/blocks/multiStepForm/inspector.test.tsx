import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmissionFields } from "@/components/editor-shell/inspector/submission-fields";

const html = (recipientEmail: string) =>
  renderToStaticMarkup(
    createElement(SubmissionFields, {
      onPatch: () => undefined,
      recipientEmail,
      submitMode: "email",
    })
  );

describe("recipient warning", () => {
  test("shows for an address that would be refused, not for a valid one", () => {
    expect(html("x@evil.com")).toContain("not a valid @biso.no address");
    expect(html("post@biso.no")).not.toContain("not a valid @biso.no address");
    expect(html("")).not.toContain("not a valid @biso.no address");
  });
});
