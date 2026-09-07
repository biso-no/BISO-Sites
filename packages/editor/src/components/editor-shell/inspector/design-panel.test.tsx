import { expect, test } from "bun:test";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DesignPanel } from "./design-panel";

interface SelectProps {
  children?: ReactNode;
  onChange: (event: { target: { value: string } }) => void;
}

const collectSelects = (node: ReactNode): ReactElement<SelectProps>[] => {
  if (!isValidElement(node)) {
    return [];
  }

  const element = node as ReactElement<{ children?: ReactNode }>;
  const descendants = Children.toArray(element.props.children).flatMap(
    collectSelects
  );
  return element.type === "select"
    ? [element as ReactElement<SelectProps>, ...descendants]
    : descendants;
};

test("DesignPanel exposes every shared layout control with safe defaults", () => {
  const html = renderToStaticMarkup(
    <DesignPanel layout={undefined} onPatch={() => undefined} />
  );

  expect(html.match(/<select/g)).toHaveLength(3);
  expect(html).toContain("Background");
  expect(html).toContain("Spacing");
  expect(html).toContain("Width");
  expect(html).toContain('<option value="auto" selected="">Auto</option>');
  expect(html).toContain('<option value="normal" selected="">Normal</option>');
  expect(html).toContain('<option value="wide" selected="">Wide</option>');
  expect(html).toContain('<option value="inverted">Dark</option>');
  expect(html).toContain('<option value="full">Full bleed</option>');
});

test("DesignPanel patches each nested layout field", () => {
  const patches: [string, unknown][] = [];
  const tree = DesignPanel({
    layout: undefined,
    onPatch: (path, value) => patches.push([path, value]),
  });
  const [background, spacing, width] = collectSelects(tree);

  background?.props.onChange({ target: { value: "brand" } });
  spacing?.props.onChange({ target: { value: "compact" } });
  width?.props.onChange({ target: { value: "prose" } });

  expect(patches).toEqual([
    ["layout.background", "brand"],
    ["layout.spacing", "compact"],
    ["layout.width", "prose"],
  ]);
});
