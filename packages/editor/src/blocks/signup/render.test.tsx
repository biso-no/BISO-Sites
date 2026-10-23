import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MultiStepFormBlock, SignupBlock } from "@/editor/types";
import { MultiStepFormRender } from "../multiStepForm/render";
import { SignupRender } from "./render";

const signup: SignupBlock = {
  heading: "Meld deg på",
  id: "s1",
  placeholder: "",
  submitMode: "database",
  topic: "signup",
  type: "signup",
};

const inDeep = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(
    createElement("section", { "data-surface": "deep" }, node)
  );

describe("signup and form markup", () => {
  test("signup renders a labelled email field and a pill button in a dark section", () => {
    const html = inDeep(
      createElement(SignupRender, {
        block: signup,
        edit: false,
        onPatch: () => undefined,
      })
    );
    expect(html).toContain('data-surface="deep"');
    expect(html).toContain("<h2");
    expect(html).toContain('aria-label="E-postadresse"');
    expect(html).toContain("bg-action");
    expect(html).not.toContain("<h1");
  });

  test("an empty heading renders no heading on the site", () => {
    const html = renderToStaticMarkup(
      createElement(SignupRender, {
        block: { ...signup, heading: "" },
        edit: false,
        onPatch: () => undefined,
      })
    );
    expect(html).not.toContain("<h2");
  });

  test("a form with no steps renders nothing on the site", () => {
    const block = {
      id: "f",
      steps: undefined,
      submitMode: "database",
      topic: "x",
      type: "multiStepForm",
    } as unknown as MultiStepFormBlock;
    expect(
      renderToStaticMarkup(
        createElement(MultiStepFormRender, {
          block,
          edit: false,
          onPatch: () => undefined,
        })
      )
    ).toBe("");
  });
});
