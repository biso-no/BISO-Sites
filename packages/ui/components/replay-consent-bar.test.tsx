import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { ReplayConsentBarProps } from "./replay-consent-bar";

const labels = {
  allow: "Allow",
  body: "Body",
  decline: "No thanks",
  privacyHref: "https://biso.no/privacy",
  privacyLink: "Read more",
  title: "Title",
};

let ReplayConsentBar: typeof import("./replay-consent-bar").ReplayConsentBar;
let openReplayConsentSettings: typeof import("./replay-consent-bar").openReplayConsentSettings;
let createRoot: typeof import("react-dom/client").createRoot;
let act: typeof import("react").act;

beforeAll(async () => {
  const win = new Window();
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Event: win.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = await import("react"));
  ({ ReplayConsentBar, openReplayConsentSettings } = await import(
    "./replay-consent-bar"
  ));
});

const roots: { unmount: () => void }[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) {
    await act(async () => r.unmount());
  }
  document.body.innerHTML = "";
});

async function mount(props: Partial<ReplayConsentBarProps> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const onChoose = props.onChoose ?? mock(async () => undefined);
  await act(async () => {
    root.render(
      createElement(ReplayConsentBar, {
        labels,
        onChoose,
        readConsent: () => "unknown" as const,
        ...props,
      })
    );
  });
  return { container, onChoose };
}

function stubOffsetHeight(value: number): () => void {
  const proto = window.HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, "offsetHeight");
  Object.defineProperty(proto, "offsetHeight", {
    configurable: true,
    get: () => value,
  });
  return () => {
    if (original) {
      Object.defineProperty(proto, "offsetHeight", original);
    } else {
      Reflect.deleteProperty(proto, "offsetHeight");
    }
  };
}

const button = (container: Element, text: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text
  ) as HTMLButtonElement;

describe("ReplayConsentBar", () => {
  test("renders nothing on the server", () => {
    const html = renderToString(
      createElement(ReplayConsentBar, {
        labels,
        onChoose: () => undefined,
        readConsent: () => "unknown" as const,
      })
    );
    expect(html).toBe("");
  });

  test("renders nothing when a choice already exists", async () => {
    const { container } = await mount({ readConsent: () => "granted" as const });
    expect(container.querySelector("section")).toBeNull();
    const second = await mount({ readConsent: () => "denied" as const });
    expect(second.container.querySelector("section")).toBeNull();
  });

  test("renders a labelled region when there is no answer", async () => {
    const { container } = await mount();
    const region = container.querySelector("section");
    expect(region?.getAttribute("aria-label")).toBe("Title");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://biso.no/privacy"
    );
  });

  test("Allow sends granted and closes", async () => {
    const { container, onChoose } = await mount();
    await act(async () => {
      button(container, "Allow").click();
    });
    expect(onChoose).toHaveBeenCalledWith("granted");
    expect(container.querySelector("section")).toBeNull();
  });

  test("No thanks sends denied and closes", async () => {
    const { container, onChoose } = await mount();
    await act(async () => {
      button(container, "No thanks").click();
    });
    expect(onChoose).toHaveBeenCalledWith("denied");
    expect(container.querySelector("section")).toBeNull();
  });

  test("stays open when saving fails", async () => {
    const { container } = await mount({
      onChoose: async () => {
        throw new Error("nope");
      },
    });
    await act(async () => {
      button(container, "Allow").click();
    });
    expect(container.querySelector("section")).not.toBeNull();
  });

  test("the open event shows it again when a choice exists", async () => {
    const { container } = await mount({ readConsent: () => "denied" as const });
    expect(container.querySelector("section")).toBeNull();
    await act(async () => {
      openReplayConsentSettings();
    });
    expect(container.querySelector("section")).not.toBeNull();
  });

  test("both buttons share the same classes", async () => {
    const { container } = await mount();
    expect(button(container, "Allow").className).toBe(
      button(container, "No thanks").className
    );
  });

  test("publishes its height while visible and clears it after a choice", async () => {
    const restore = stubOffsetHeight(140);
    const root = document.documentElement;
    const { container } = await mount();
    expect(root.style.getPropertyValue("--replay-consent-bar-height")).toBe(
      "140px"
    );
    expect(root.style.getPropertyValue("scroll-padding-bottom")).toBe("140px");
    expect(document.body.style.paddingBottom).toBe("140px");
    await act(async () => {
      button(container, "No thanks").click();
    });
    expect(root.style.getPropertyValue("--replay-consent-bar-height")).toBe("");
    expect(document.body.style.paddingBottom).toBe("");
    expect(root.style.getPropertyValue("scroll-padding-bottom")).toBe("");
    restore();
  });

  test("reserveBodySpace false publishes the height but leaves the body alone", async () => {
    const restore = stubOffsetHeight(120);
    const root = document.documentElement;
    await mount({ reserveBodySpace: false });
    expect(root.style.getPropertyValue("--replay-consent-bar-height")).toBe(
      "120px"
    );
    expect(document.body.style.paddingBottom).toBe("");
    expect(root.style.getPropertyValue("scroll-padding-bottom")).toBe("");
    restore();
  });
});
