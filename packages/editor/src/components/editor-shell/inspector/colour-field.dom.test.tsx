import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ColourField } from "./colour-field";
import { click, fire, installDom, typeInto } from "./dom-helpers";

let restore: () => void = () => undefined;
beforeAll(() => {
  restore = installDom();
});
afterAll(() => restore());

const mounted: { host: HTMLElement; root: Root }[] = [];
afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function mount(value = "#336699") {
  const calls = { change: [] as string[], commit: [] as string[] };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const render = (v: string) =>
    act(() => {
      root.render(
        <ColourField
          label="Dark"
          onChange={(hex) => calls.change.push(hex)}
          onCommit={(hex) => calls.commit.push(hex)}
          value={v}
        />
      );
    });
  render(value);
  const area = host.querySelector('[role="slider"]') as HTMLElement;
  area.getBoundingClientRect = () =>
    ({ height: 100, left: 0, top: 0, width: 100 }) as DOMRect;
  return { area, calls, host, render };
}

const hexInput = (host: Element) =>
  host.querySelector('input[type="text"]') as HTMLInputElement;

describe("saturation/value area", () => {
  test("is a labelled slider whose value text is the hex", () => {
    const { area } = mount("#336699");
    expect(area.getAttribute("aria-label")).toBe("Saturation and brightness");
    expect(area.getAttribute("aria-valuetext")).toBe("#336699");
  });

  test("arrow keys move 1%, shift 10%, and each key commits", () => {
    const { area, calls } = mount("#336699");
    fire(area, "onKeyDown", { key: "ArrowRight" });
    const one = area.getAttribute("aria-valuetext");
    expect(one).not.toBe("#336699");
    expect(calls.commit).toHaveLength(1);
    fire(area, "onKeyDown", { key: "ArrowRight", shiftKey: true });
    expect(area.getAttribute("aria-valuetext")).not.toBe(one);
    expect(calls.commit).toHaveLength(2);
  });

  test("a drag repaints live and commits once on release", () => {
    const { area, calls } = mount("#336699");
    fire(area, "onPointerDown", { clientX: 10, clientY: 10, pointerId: 1 });
    fire(area, "onPointerMove", { clientX: 50, clientY: 20, pointerId: 1 });
    fire(area, "onPointerMove", { clientX: 90, clientY: 30, pointerId: 1 });
    expect(calls.change.length).toBe(3);
    expect(calls.commit).toHaveLength(0);
    fire(area, "onPointerUp", { clientX: 90, clientY: 30, pointerId: 1 });
    expect(calls.commit).toEqual([calls.change.at(-1) as string]);
  });

  test("moving without a pressed pointer does nothing", () => {
    const { area, calls } = mount("#336699");
    fire(area, "onPointerMove", { clientX: 50, clientY: 20, pointerId: 1 });
    expect(calls.change).toHaveLength(0);
  });
});

describe("hue slider", () => {
  test("is a native range 0-359; input is live, release commits", () => {
    const { calls, host } = mount("#ff0000");
    const hue = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(hue.min).toBe("0");
    expect(hue.max).toBe("359");
    typeInto(hue, "120");
    expect(calls.change.at(-1)).toBe("#00ff00");
    expect(calls.commit).toHaveLength(0);
    fire(hue, "onPointerUp");
    expect(calls.commit).toEqual(["#00ff00"]);
  });
});

describe("hex field", () => {
  test("Enter commits the normalised value", () => {
    const { calls, host } = mount();
    typeInto(hexInput(host), "#9B5DE5");
    fire(hexInput(host), "onKeyDown", { key: "Enter" });
    expect(calls.commit).toEqual(["#9b5de5"]);
  });

  test("blur commits too", () => {
    const { calls, host } = mount();
    typeInto(hexInput(host), "abc");
    fire(hexInput(host), "onBlur");
    expect(calls.commit).toEqual(["#aabbcc"]);
  });

  test("invalid input says so, commits nothing and keeps the value", () => {
    const { area, calls, host } = mount("#336699");
    typeInto(hexInput(host), "zzz");
    fire(hexInput(host), "onKeyDown", { key: "Enter" });
    expect(host.textContent).toContain("Not a colour");
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(calls.commit).toHaveLength(0);
    expect(area.getAttribute("aria-valuetext")).toBe("#336699");
  });

  test("Escape reverts the text and clears the error", () => {
    const { host } = mount("#336699");
    typeInto(hexInput(host), "zzz");
    fire(hexInput(host), "onKeyDown", { key: "Enter" });
    fire(hexInput(host), "onKeyDown", { key: "Escape" });
    expect(hexInput(host).value).toBe("#336699");
    expect(host.textContent).not.toContain("Not a colour");
  });

  test("follows a new value from the parent", () => {
    const { area, host, render } = mount("#336699");
    render("#fecd45");
    expect(hexInput(host).value).toBe("#fecd45");
    expect(area.getAttribute("aria-valuetext")).toBe("#fecd45");
  });
});

describe("quick picks", () => {
  test("four labelled swatches commit their colour", () => {
    const { calls, host } = mount();
    const picks = [...host.querySelectorAll("button")].map((b) =>
      b.getAttribute("aria-label")
    );
    expect(picks).toEqual([
      "Deep #001a35",
      "Blue #1668ae",
      "Sky #3aa3e1",
      "Sun #fecd45",
    ]);
    click(host.querySelector('[aria-label="Sky #3aa3e1"]') as Element);
    expect(calls.commit).toEqual(["#3aa3e1"]);
  });
});
