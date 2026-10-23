import { expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { Block } from "@/editor/types";
import { BlockVisibility } from "./block-visibility";

type AnyEl = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;

const checkboxOf = (node: ReactNode): AnyEl | undefined => {
  if (!isValidElement(node)) {
    return undefined;
  }
  const el = node as AnyEl;
  if (el.type === "input" && el.props.type === "checkbox") {
    return el;
  }
  if (typeof el.type === "function") {
    const found = checkboxOf((el.type as (p: unknown) => ReactNode)(el.props));
    if (found) {
      return found;
    }
  }
  const kids = Array.isArray(el.props.children)
    ? el.props.children
    : [el.props.children];
  for (const kid of kids) {
    const found = checkboxOf(kid as ReactNode);
    if (found) {
      return found;
    }
  }
  return undefined;
};

test("Hide on phone patches the block", () => {
  const patches: [string, unknown][] = [];
  const tree = BlockVisibility({
    block: { id: "b-1", type: "text" } as unknown as Block,
    onPatch: (p, v) => patches.push([p, v]),
  });
  (
    checkboxOf(tree)?.props.onChange as (e: {
      target: { checked: boolean };
    }) => void
  )({ target: { checked: true } });
  expect(patches).toEqual([["hideOnPhone", true]]);
});
