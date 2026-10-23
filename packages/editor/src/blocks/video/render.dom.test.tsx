import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { VideoBlock } from "@/editor/types";
import { VideoRender } from "./render";

const previous = {
  Event: globalThis.Event,
  MouseEvent: globalThis.MouseEvent,
  Node: globalThis.Node,
  document: globalThis.document,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };

beforeAll(() => {
  const win = new Window();
  Object.assign(globalThis, {
    Event: win.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: win.MouseEvent,
    Node: win.Node,
    document: win.document,
    window: win,
  });
});

afterAll(() => {
  Object.assign(globalThis, previous);
  flags.IS_REACT_ACT_ENVIRONMENT = undefined;
});

const block: VideoBlock = {
  caption: "",
  id: "v1",
  ratio: "16/9",
  style: "featured",
  type: "video",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

function mount(edit: boolean) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(VideoRender, { block, edit, onPatch: () => undefined })
    );
  });
  return host;
}

const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("featured video click", () => {
  test("on the site a click swaps in the iframe and removes the button", () => {
    const host = mount(false);
    const button = host.querySelector("button");
    expect(button).not.toBeNull();
    click(button as Element);
    const iframe = host.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("allow")).toBe(
      "autoplay; fullscreen; picture-in-picture"
    );
    expect(iframe?.getAttribute("src")).toContain("youtube-nocookie.com");
    expect(host.querySelector("button")).toBeNull();
  });

  test("in the editor the button is inert and a click loads no player", () => {
    const host = mount(true);
    const button = host.querySelector("button") as Element;
    expect(button.getAttribute("tabindex")).toBe("-1");
    expect(button.getAttribute("aria-hidden")).toBe("true");
    expect(button.className).toContain("pointer-events-none");
    click(button);
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("video")).toBeNull();
  });
});
