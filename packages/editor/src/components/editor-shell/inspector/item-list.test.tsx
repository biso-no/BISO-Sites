import { expect, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { ItemList } from "./item-list";

type AnyEl = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;

const collect = (node: ReactNode, out: AnyEl[] = []): AnyEl[] => {
  if (Array.isArray(node)) {
    for (const child of node) {
      collect(child, out);
    }
  } else if (isValidElement(node)) {
    const el = node as AnyEl;
    out.push(el);
    collect(el.props.children, out);
  }
  return out;
};

const setup = (items: string[], max?: number) => {
  const changes: string[][] = [];
  const tree = ItemList<string>({
    addLabel: "Add",
    items,
    max,
    newItem: () => "new",
    onChange: (next) => changes.push(next),
    renderItem: (item) => <span>{item}</span>,
    title: (_, i) => `Item ${i + 1}`,
  });
  const buttons = collect(tree).filter((el) => el.type === "button");
  const byLabel = (label: string) =>
    buttons.filter((b) => b.props["aria-label"] === label);
  return { buttons, byLabel, changes };
};

const click = (el: AnyEl) => (el.props.onClick as () => void)();

test("Add appends newItem()", () => {
  const { buttons, changes } = setup(["a"]);
  click(buttons.at(-1) as AnyEl);
  expect(changes[0]).toEqual(["a", "new"]);
});

test("Add is disabled at max", () => {
  const { buttons } = setup(["a", "b"], 2);
  expect((buttons.at(-1) as AnyEl).props.disabled).toBe(true);
});

test("move down swaps two items", () => {
  const { byLabel, changes } = setup(["a", "b", "c"]);
  click(byLabel("Move down")[0]);
  expect(changes[0]).toEqual(["b", "a", "c"]);
});

test("remove drops one", () => {
  const { byLabel, changes } = setup(["a", "b", "c"]);
  click(byLabel("Remove")[1]);
  expect(changes[0]).toEqual(["a", "c"]);
});
