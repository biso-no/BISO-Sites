import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { parseInert, sanitizeRichText } from "./sanitize";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  globalThis.document = previous.document;
  globalThis.Node = previous.Node;
});

describe("sanitizeRichText", () => {
  test("keeps inline formatting and plain links", () => {
    expect(
      sanitizeRichText('Hi <b>there</b> <a href="https://biso.no">x</a>')
    ).toBe('Hi <b>there</b> <a href="https://biso.no">x</a>');
  });

  test("drops event handlers and elements that run script", () => {
    // Rendered as markup inside the admin, a stored handler would run with
    // the editor's session.
    expect(sanitizeRichText('<img src="x" onerror="alert(1)">a')).toBe("a");
    expect(sanitizeRichText('<svg onload="alert(1)"></svg>b')).toBe("b");
    expect(sanitizeRichText('<b onclick="alert(1)">c</b>')).toBe("<b>c</b>");
  });

  test("keeps only http(s) and mailto links", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      "<a>x</a>"
    );
    expect(sanitizeRichText('<a href="mailto:hi@biso.no">x</a>')).toBe(
      '<a href="mailto:hi@biso.no">x</a>'
    );
    expect(sanitizeRichText('<a href="/events">x</a>')).toBe(
      '<a href="/events">x</a>'
    );
  });

  test("turns the blocks a browser inserts on Enter into line breaks", () => {
    // Chrome wraps each new line in a <div>. Unwrapping it silently joined
    // the lines back together on blur.
    expect(sanitizeRichText("one<div>two</div><div>three</div>")).toBe(
      "one<br>two<br>three"
    );
    expect(sanitizeRichText("<div>only</div>")).toBe("only");
  });
});

/** The prototype that defines `innerHTML` for an element. */
function innerHtmlOwner(element: object): object {
  let proto: object | null = Object.getPrototypeOf(element);
  while (proto && !Object.hasOwn(proto, "innerHTML")) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) {
    throw new Error("innerHTML is not defined on the element's prototypes");
  }
  return proto;
}

/** A window that runs inline event handlers, so a handler that fires shows. */
function scriptingWindow(): Window {
  return new Window({
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
}

describe("sanitizeRichText parses inert", () => {
  // Markup set as innerHTML in the live document starts loading at once: an
  // `<img onerror>` ran in Chrome before the walk could remove it, while the
  // returned string was clean. happy-dom loads no images, so these tests
  // observe which document the markup is parsed in, and whether a handler on
  // parsed elements can run.
  test("never parses markup in the live document", () => {
    const window = scriptingWindow();
    const live = window.document;
    const swap = { Node: globalThis.Node, document: globalThis.document };
    globalThis.document = live as unknown as Document;
    globalThis.Node = window.Node as unknown as typeof Node;

    // Record the document of every element whose innerHTML is set.
    const owner = innerHtmlOwner(live.createElement("div"));
    const descriptor = Object.getOwnPropertyDescriptor(owner, "innerHTML");
    const parsedIn: unknown[] = [];
    Object.defineProperty(owner, "innerHTML", {
      ...descriptor,
      set(this: { ownerDocument: unknown }, value: string) {
        parsedIn.push(this.ownerDocument);
        descriptor?.set?.call(this, value);
      },
    });
    const createdPlain = spyOn(live, "createElement");
    try {
      const out = sanitizeRichText(
        'a<img src="x" onerror="window.__fired = 1"><div>b</div>'
      );

      expect(out).toBe("a<br>b");
      expect(parsedIn.length).toBeGreaterThan(0);
      expect(parsedIn.includes(live)).toBe(false);
      expect(
        parsedIn.every(
          (doc) => (doc as { defaultView: unknown }).defaultView === null
        )
      ).toBe(true);
      expect(createdPlain).not.toHaveBeenCalled();
      expect((window as unknown as { __fired?: number }).__fired).toBe(
        undefined
      );
    } finally {
      createdPlain.mockRestore();
      if (descriptor) {
        Object.defineProperty(owner, "innerHTML", descriptor);
      }
      Object.assign(globalThis, swap);
    }
  });

  test("a handler on the parsed markup cannot run, where a live one does", () => {
    const window = scriptingWindow();
    const flags = window as unknown as { __inert?: number; __live?: number };
    const swap = { document: globalThis.document };
    globalThis.document = window.document as unknown as Document;
    try {
      // Control: the window does run inline handlers on live elements.
      const live = window.document.createElement("div");
      live.innerHTML = '<b onclick="window.__live = 1">x</b>';
      (live.querySelector("b") as unknown as HTMLElement).click();
      expect(flags.__live).toBe(1);

      const inert = parseInert('<b onclick="window.__inert = 1">x</b>');
      (inert.querySelector("b") as HTMLElement).click();
      expect(flags.__inert).toBe(undefined);
      expect(inert.ownerDocument.defaultView).toBeNull();
    } finally {
      Object.assign(globalThis, swap);
    }
  });
});
