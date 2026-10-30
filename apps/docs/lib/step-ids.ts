/**
 * Ids for `<Step title>` headings, so a link can point at one step:
 * `/guide/recruitment/review-applications#shortlist-or-archive-a-candidate`.
 *
 * `stepSlug` turns a title into an id. `remarkStepIds` runs at MDX compile
 * time, where it sees the whole page, and gives every `<Step>` an `id` that is
 * unique on that page: a second step with the same title gets `-1`, and a step
 * never takes a heading's id.
 */

const APOSTROPHES = /['’]/g;
const NOT_SLUG = /[^\p{Letter}\p{Number}]+/gu;
const EDGE_HYPHENS = /^-+|-+$/g;

/** Lowercase, apostrophes dropped, every other run of non-letters a hyphen. */
export function stepSlug(title: string): string {
  const slug = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(NOT_SLUG, "-")
    .replace(EDGE_HYPHENS, "");
  return slug || "step";
}

/** `base`, or `base-1`, `base-2`… whichever isn't in `used` yet. Adds it. */
export function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  for (let n = 1; used.has(slug); n += 1) {
    slug = `${base}-${n}`;
  }
  used.add(slug);
  return slug;
}

/** The parts of an mdast/MDX node this plugin reads. */
export interface StepIdNode {
  attributes?: { name?: string; type: string; value?: unknown }[];
  children?: StepIdNode[];
  data?: { hProperties?: { id?: unknown } };
  name?: string | null;
  type: string;
}

type JsxAttribute = NonNullable<StepIdNode["attributes"]>[number];

const JSX_ELEMENT_TYPES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);

function walk(node: StepIdNode, visit: (node: StepIdNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
}

function isStep(node: StepIdNode): boolean {
  return JSX_ELEMENT_TYPES.has(node.type) && node.name === "Step";
}

/** A plain string attribute, e.g. `title="Sign in"`. */
function stringAttribute(node: StepIdNode, name: string): string | undefined {
  const attribute = node.attributes?.find(
    (entry: JsxAttribute) =>
      entry.type === "mdxJsxAttribute" && entry.name === name
  );
  return typeof attribute?.value === "string" ? attribute.value : undefined;
}

/**
 * Gives every `<Step title="…">` on a page an `id` attribute. Runs after
 * Fumadocs' heading plugin, so the heading ids are known and kept clear of.
 * A step that already has a string `id` keeps it.
 */
export function remarkStepIds() {
  return (tree: StepIdNode): void => {
    const used = new Set<string>();
    walk(tree, (node) => {
      const headingId = node.data?.hProperties?.id;
      if (node.type === "heading" && typeof headingId === "string") {
        used.add(headingId);
      }
      if (isStep(node)) {
        const ownId = stringAttribute(node, "id");
        if (ownId) {
          used.add(ownId);
        }
      }
    });
    walk(tree, (node) => {
      if (!isStep(node) || stringAttribute(node, "id")) {
        return;
      }
      const title = stringAttribute(node, "title");
      if (!title) {
        return;
      }
      node.attributes ??= [];
      node.attributes.push({
        name: "id",
        type: "mdxJsxAttribute",
        value: uniqueSlug(stepSlug(title), used),
      });
    });
  };
}
