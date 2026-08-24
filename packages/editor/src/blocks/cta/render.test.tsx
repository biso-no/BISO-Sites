import { describe, expect, test } from "bun:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CtaBlock } from "@/editor/types";
import { CtaRender, resolveCtaBackground } from "./render";

interface EditableProps {
  children?: ReactNode;
  "data-edit"?: string;
  onBlur?: (event: { currentTarget: { textContent: string | null } }) => void;
  titleProps?: {
    onBlur?: (event: { currentTarget: { textContent: string | null } }) => void;
  };
}

const collectElements = (node: ReactNode): ReactElement<EditableProps>[] => {
  if (!isValidElement(node)) {
    return [];
  }

  const element = node as ReactElement<EditableProps>;
  return [
    element,
    ...Children.toArray(element.props.children).flatMap(collectElements),
  ];
};

const cta = (patch: Partial<CtaBlock> = {}): CtaBlock => ({
  id: "cta-1",
  label: "Join us",
  title: "Ready to jump in?",
  type: "cta",
  url: "/join",
  ...patch,
});

describe("CTA surface compatibility", () => {
  test("explicit layout backgrounds override legacy variants", () => {
    const block = {
      ...cta({ variant: "gradient" }),
      layout: { background: "default" as const },
    };

    expect(resolveCtaBackground(block, "default")).toBe("default");
  });

  test("legacy variants provide a fallback while background stays automatic", () => {
    expect(resolveCtaBackground(cta({ variant: "gradient" }), "muted")).toBe(
      "brand"
    );
    expect(resolveCtaBackground(cta({ variant: "banner" }), "default")).toBe(
      "inverted"
    );
    expect(resolveCtaBackground(cta({ variant: "card" }), "muted")).toBe(
      "muted"
    );
  });

  test("preserves the title, label and destination in public rendering", () => {
    const html = renderToStaticMarkup(
      <CtaRender
        background="default"
        block={{
          ...cta({ variant: "gradient" }),
          layout: { background: "default" },
        }}
        edit={false}
        onPatch={() => undefined}
      />
    );

    expect(html).toContain("Ready to jump in?");
    expect(html).toContain("Join us");
    expect(html).toContain('href="/join"');
    expect(html).toContain("bg-background");
    expect(html).not.toContain("lg:mb-12");
    expect(html).not.toContain("pg-cta");
  });

  test("uses the same implicit wide width reported by the Design panel", () => {
    const html = renderToStaticMarkup(
      <CtaRender
        background="default"
        block={cta()}
        edit={false}
        onPatch={() => undefined}
      />
    );

    expect(html).toContain("max-w-7xl");
    expect(html).not.toContain("max-w-5xl");
  });

  test("preserves inline title and label editing paths", () => {
    const patches: [string, unknown][] = [];
    const elements = collectElements(
      CtaRender({
        background: "default",
        block: cta(),
        edit: true,
        onPatch: (path, value) => patches.push([path, value]),
      })
    );
    const heading = elements.find(
      (element) => element.props.titleProps?.onBlur
    );
    const button = elements.find(
      (element) => element.props["data-edit"] === "1" && element.props.onBlur
    );

    heading?.props.titleProps?.onBlur?.({
      currentTarget: { textContent: "A better title" },
    });
    button?.props.onBlur?.({
      currentTarget: { textContent: "Apply now" },
    });

    expect(patches).toEqual([
      ["title", "A better title"],
      ["label", "Apply now"],
    ]);
  });
});
