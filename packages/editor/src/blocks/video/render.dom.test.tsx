import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
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

const mounted: { host: HTMLElement; root: Root }[] = [];

afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function mount(edit: boolean, patch: Partial<VideoBlock> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => {
    root.render(
      createElement(VideoRender, {
        block: { ...block, ...patch },
        edit,
        onPatch: () => undefined,
      })
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

  test("the playing embed sits in an unclipped box of the same ratio and takes focus", () => {
    const host = mount(false, { ratio: "21/9" });
    click(host.querySelector("button") as Element);
    const iframe = host.querySelector("iframe") as Element;
    const box = iframe.parentElement as Element;
    // The chevron's clip-path would cut the corners off the control bar.
    expect(box.classList.contains("chevron-frame")).toBe(false);
    for (const cls of ["relative", "overflow-hidden", "rounded-biso-md"]) {
      expect(box.classList.contains(cls)).toBe(true);
    }
    expect(box.getAttribute("style")).toContain("aspect-ratio: 1 / 0.42857");
    expect(document.activeElement).toBe(iframe);
  });

  test("a playing file letterboxes inside its box instead of cropping", () => {
    const host = mount(false, { url: "https://x.test/clip.mp4" });
    click(host.querySelector("button") as Element);
    const video = host.querySelector("video") as Element;
    expect(video.classList.contains("object-contain")).toBe(true);
    expect(video.classList.contains("object-cover")).toBe(false);
    expect(video.parentElement?.classList.contains("chevron-frame")).toBe(
      false
    );
    expect(document.activeElement).toBe(video);
  });

  test("in the editor the button is inert and a click loads no player", () => {
    const host = mount(true);
    const button = host.querySelector("button") as Element;
    expect(button.getAttribute("tabindex")).toBe("-1");
    expect(button.getAttribute("aria-hidden")).toBe("true");
    expect(button.classList.contains("pointer-events-none")).toBe(true);
    expect(button.classList.contains("absolute")).toBe(true);
    click(button);
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("video")).toBeNull();
  });
});
