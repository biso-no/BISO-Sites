import { expect, test } from "bun:test";
import {
  remarkStepIds,
  type StepIdNode,
  stepSlug,
  uniqueSlug,
} from "./step-ids";

const LOWER_HYPHENATED = /^[\p{Ll}\p{N}]+(?:-[\p{Ll}\p{N}]+)*$/u;

/** A `<Step>` as remark-mdx parses it, with string attributes. */
function step(attributes: Record<string, string>): StepIdNode {
  return {
    attributes: Object.entries(attributes).map(([name, value]) => ({
      name,
      type: "mdxJsxAttribute",
      value,
    })),
    children: [],
    name: "Step",
    type: "mdxJsxFlowElement",
  };
}

function heading(id: string): StepIdNode {
  return { children: [], data: { hProperties: { id } }, type: "heading" };
}

function stepIds(tree: StepIdNode): (string | undefined)[] {
  const ids: (string | undefined)[] = [];
  const visit = (node: StepIdNode) => {
    if (node.name === "Step") {
      const id = node.attributes?.find((a) => a.name === "id")?.value;
      ids.push(typeof id === "string" ? id : undefined);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(tree);
  return ids;
}

test("a step title becomes a lowercase, hyphenated slug", () => {
  expect(stepSlug("Shortlist or archive a candidate")).toBe(
    "shortlist-or-archive-a-candidate"
  );
  expect(stepSlug("Start a new vacancy, or copy last year's")).toBe(
    "start-a-new-vacancy-or-copy-last-years"
  );
  expect(stepSlug("Take the recruitment tour (HR and global admins)")).toBe(
    "take-the-recruitment-tour-hr-and-global-admins"
  );
  expect(stepSlug("  Open the vacancy’s applications  ")).toBe(
    "open-the-vacancys-applications"
  );
  expect(stepSlug("Send the offer — yourself")).toBe("send-the-offer-yourself");
  expect(stepSlug("Åpne søknader")).toBe("åpne-søknader");
  for (const title of ["Sign in", "Fill in Essentials", "Pick a time 2"]) {
    expect(stepSlug(title)).toMatch(LOWER_HYPHENATED);
  }
});

test("the slug is the same every time", () => {
  expect(stepSlug("Read a candidate")).toBe(stepSlug("Read a candidate"));
});

test("a title with no letters or numbers still gets an id", () => {
  expect(stepSlug("—")).toBe("step");
});

test("uniqueSlug numbers repeats from 1", () => {
  const used = new Set<string>();
  expect(uniqueSlug("sign-in", used)).toBe("sign-in");
  expect(uniqueSlug("sign-in", used)).toBe("sign-in-1");
  expect(uniqueSlug("sign-in", used)).toBe("sign-in-2");
});

test("every step on a page gets a unique id, nested ones too", () => {
  const tree: StepIdNode = {
    children: [
      {
        children: [
          step({ title: "Open the dialog" }),
          step({ title: "Pick a time" }),
        ],
        name: "Steps",
        type: "mdxJsxFlowElement",
      },
      {
        children: [
          step({ title: "Open the dialog" }),
          step({ title: "Pick a time" }),
        ],
        name: "Steps",
        type: "mdxJsxFlowElement",
      },
    ],
    type: "root",
  };
  remarkStepIds()(tree);
  expect(stepIds(tree)).toEqual([
    "open-the-dialog",
    "pick-a-time",
    "open-the-dialog-1",
    "pick-a-time-1",
  ]);
});

test("a step never takes a heading's id, wherever the heading is", () => {
  const tree: StepIdNode = {
    children: [step({ title: "Steps" }), heading("steps")],
    type: "root",
  };
  remarkStepIds()(tree);
  expect(stepIds(tree)).toEqual(["steps-1"]);
});

test("a step keeps its own id, and other steps keep clear of it", () => {
  const tree: StepIdNode = {
    children: [
      step({ title: "Sign in" }),
      step({ id: "sign-in-1", title: "Sign in" }),
      step({ title: "Sign in" }),
    ],
    type: "root",
  };
  remarkStepIds()(tree);
  expect(stepIds(tree)).toEqual(["sign-in", "sign-in-1", "sign-in-2"]);
});

test("a step without a string title gets no id", () => {
  const untitled = step({});
  const expression: StepIdNode = {
    ...step({}),
    attributes: [
      {
        name: "title",
        type: "mdxJsxAttribute",
        value: { type: "mdxJsxAttributeValueExpression", value: "title" },
      },
    ],
  };
  const tree: StepIdNode = { children: [untitled, expression], type: "root" };
  remarkStepIds()(tree);
  expect(stepIds(tree)).toEqual([undefined, undefined]);
});

test("the same page gives the same ids on every build", () => {
  const build = () => {
    const tree: StepIdNode = {
      children: [step({ title: "Sign in" }), step({ title: "Sign in" })],
      type: "root",
    };
    remarkStepIds()(tree);
    return stepIds(tree);
  };
  expect(build()).toEqual(build());
});
