import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { sanitizeRichText } from "./sanitize";

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
