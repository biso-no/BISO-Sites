import { Window } from "happy-dom";
import { act } from "react";

/**
 * Happy-dom for a test file. React decides at import time whether the browser
 * fires `input` events, and in a bun process the module is usually evaluated
 * before any DOM exists, so tests call the handlers React attached directly.
 */
export function installDom() {
  const previous = {
    Event: globalThis.Event,
    HTMLInputElement: globalThis.HTMLInputElement,
    Node: globalThis.Node,
    document: globalThis.document,
    window: globalThis.window,
  };
  const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const win = new Window();
  Object.assign(globalThis, {
    Event: win.Event,
    HTMLInputElement: win.HTMLInputElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: win.Node,
    document: win.document,
    window: win,
  });
  return () => {
    Object.assign(globalThis, previous);
    flags.IS_REACT_ACT_ENVIRONMENT = undefined;
  };
}

type Handler = (event: unknown) => void;

/** Calls the React prop `name` on `el` with a synthetic-event-like object. */
export function fire(
  el: Element,
  name: string,
  extra: Record<string, unknown> = {}
) {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
  const props = (el as unknown as Record<string, unknown>)[key ?? ""] as Record<
    string,
    Handler | undefined
  >;
  act(() => {
    props[name]?.({
      currentTarget: el,
      target: el,
      preventDefault: () => undefined,
      ...extra,
    });
  });
}

export function typeInto(el: Element, value: string) {
  (el as HTMLInputElement).value = value;
  fire(el, "onChange");
}

export function click(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}
