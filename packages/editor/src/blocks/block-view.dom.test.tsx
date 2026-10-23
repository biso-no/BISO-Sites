import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block } from "@/editor/types";
import { BlockView } from "./block-view";
import { allBlocks } from "./index";
import { registerBlock } from "./registry";
import type { BlockDefinition } from "./types";

const previous = {
  Node: globalThis.Node,
  document: globalThis.document,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };

beforeAll(() => {
  const win = new Window();
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: win.Node,
    document: win.document,
    window: win,
  });
});

afterAll(() => {
  Object.assign(globalThis, previous);
  flags.IS_REACT_ACT_ENVIRONMENT = undefined;
});

const mounted: { host: HTMLElement; root: Root }[] = [];

afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

const original = (type: Block["type"]): BlockDefinition => {
  const def = allBlocks().find((candidate) => candidate.type === type);
  if (!def) {
    throw new Error(`${type} is not registered`);
  }
  return def;
};

/** A block whose Render throws while its title is "bad". */
function Fragile({ block }: { block: { title?: string } }) {
  if (block.title === "bad") {
    throw new Error("malformed block");
  }
  return createElement("p", null, "fine");
}

/** Runs `run` with `type`'s Render swapped for Fragile and errors muted. */
function withFragile(type: Block["type"], v2: boolean, run: () => void) {
  const def = original(type);
  registerBlock({ ...def, Render: Fragile as never, v2: v2 || undefined });
  // React reports every caught render error on the console.
  const muted = spyOn(console, "error").mockImplementation(() => undefined);
  try {
    run();
  } finally {
    muted.mockRestore();
    registerBlock(def);
  }
}

const bad = { id: "b1", title: "bad", type: "divider" } as unknown as Block;

function mount(block: Block, edit: boolean) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const render = (next: Block) =>
    act(() => {
      root.render(
        createElement(BlockView, {
          background: "default",
          block: next,
          edit,
          onPatch: () => undefined,
        })
      );
    });
  render(block);
  return { host, render };
}

describe("a block that throws", () => {
  test("shows a small error card in the editor, naming the block type", () => {
    withFragile("divider", true, () => {
      const { host } = mount(bad, true);
      expect(host.textContent).toContain("This block couldn't be shown");
      expect(host.textContent).toContain("divider");
    });
  });

  test("renders nothing on the site, so the column hides its slot", () => {
    withFragile("divider", true, () => {
      const { host } = mount(bad, false);
      expect(host.textContent).toBe("");
      const wrapper = host.querySelector("[data-block]");
      expect(wrapper?.childNodes.length ?? 0).toBe(0);
    });
  });

  test("a legacy block is caught too, frame and all", () => {
    withFragile("documents", false, () => {
      const block = { ...bad, type: "documents" } as unknown as Block;
      expect(mount(block, false).host.textContent).toBe("");
      expect(mount(block, true).host.textContent).toContain("documents");
    });
  });

  test("the block renders again once an edit repairs it", () => {
    withFragile("divider", true, () => {
      const { host, render } = mount(bad, true);
      render({ ...bad, title: "good" } as unknown as Block);
      expect(host.textContent).toBe("fine");
    });
  });

  test("server rendering of the site skips it instead of failing the page", () => {
    withFragile("divider", true, () => {
      const html = renderToStaticMarkup(
        createElement(BlockView, {
          background: "default",
          block: bad,
          edit: false,
          onPatch: () => undefined,
        })
      );
      expect(html).not.toContain("fine");
      expect(html).not.toContain("couldn");
    });
  });
});
