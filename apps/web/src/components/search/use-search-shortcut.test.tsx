// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchShortcut } from "./use-search-shortcut";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let onOpen = vi.fn();

function Harness() {
  useSearchShortcut(onOpen);
  return null;
}

function press(
  target: EventTarget,
  init: KeyboardEventInit & { key: string }
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(async () => {
  onOpen = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(createElement(Harness));
  });
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
});

describe("useSearchShortcut", () => {
  it("opens on / pressed on the page", () => {
    const event = press(document.body, { key: "/" });
    expect(onOpen).toHaveBeenCalledTimes(1);
    // The / must not reach the field that opens, or Firefox's quick find.
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens on / typed with Shift, as on a Norwegian keyboard", () => {
    press(document.body, { key: "/", shiftKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("leaves / alone while the visitor types in a field", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const insideEditable = document.createElement("span");
    editable.append(insideEditable);
    document.body.append(input, textarea, select, editable);

    for (const target of [input, textarea, select, editable, insideEditable]) {
      const event = press(target, { key: "/" });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens on Cmd+K and Ctrl+K, not on K alone", () => {
    press(document.body, { key: "k", metaKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
    press(document.body, { key: "k", ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(2);
    press(document.body, { key: "K", ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(3);
    press(document.body, { key: "k" });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("ignores the keys when another modifier is held", () => {
    press(document.body, { key: "/", altKey: true });
    press(document.body, { key: "/", ctrlKey: true });
    press(document.body, { key: "/", metaKey: true });
    press(document.body, { key: "k", ctrlKey: true, shiftKey: true });
    press(document.body, { key: "k", metaKey: true, altKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores Ctrl+K inside a field too", () => {
    const input = document.createElement("input");
    document.body.append(input);
    press(input, { key: "k", ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores the keys inside an open dialog", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);
    press(button, { key: "/" });
    press(button, { key: "k", metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a key another handler already took", () => {
    const stopper = document.createElement("div");
    document.body.append(stopper);
    stopper.addEventListener("keydown", (event) => event.preventDefault());
    press(stopper, { key: "/" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", async () => {
    await act(() => {
      root?.unmount();
    });
    root = null;
    press(document.body, { key: "/" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
