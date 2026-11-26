import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { PLACEHOLDERS } from "@repo/shared/big-events/messages/text";
import { act, createElement, useState } from "react";
import {
  findButton,
  findElements,
  type TestElement,
} from "@/test/react-dom-harness";
import { click, createMounter, installMocks, type } from "./test-setup";

installMocks();

const { MessageFields } = await import("./message-fields");
const { insertAtCursor } = await import("./placeholder-buttons");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());

function Fields({ language = "en" }: { language?: "no" | "en" }) {
  const [value, setValue] = useState({ body: "", title: "" });
  return createElement(MessageFields, {
    language,
    onChange: (field: "body" | "title", next: string) =>
      setValue((previous) => ({ ...previous, [field]: next })),
    placeholders: PLACEHOLDERS,
    value,
  });
}

function field(container: TestElement, tagName: string): TestElement {
  const [element] = findElements(
    container,
    (candidate) => candidate.tagName === tagName
  );
  if (!element) {
    throw new Error(`No ${tagName}`);
  }
  return element;
}

/** Where the caret is, as a browser keeps it on the field. */
function placeCaret(element: TestElement, start: number, end = start): void {
  Object.assign(element, { selectionEnd: end, selectionStart: start });
}

describe("placeholder buttons", () => {
  test("a button inserts the token at the cursor", async () => {
    const container = await mounter.mount(Fields, {});
    const body = field(container, "TEXTAREA");
    await type(body, "Hi , see you");
    placeCaret(body, 3);

    await click(findButton(container, "First name"));

    expect(body.value).toBe("Hi {first name}, see you");
  });

  test("a button inserts the token in the field's language", async () => {
    // The admin reads English; these are the Norwegian fields.
    const container = await mounter.mount(Fields, { language: "no" });
    const body = field(container, "TEXTAREA");

    await click(findButton(container, "First name"));
    await click(findButton(container, "Trip home"));

    expect(body.value).toBe("{fornavn}{hjemreise}");
  });

  test("a selection is replaced by the token", async () => {
    const container = await mounter.mount(Fields, {});
    const body = field(container, "TEXTAREA");
    await type(body, "Your bus is BUS today");
    placeCaret(body, 12, 15);

    await click(findButton(container, "Bus"));

    expect(body.value).toBe("Your bus is {bus} today");
  });

  test("the title gets the token once it was the field in use", async () => {
    const container = await mounter.mount(Fields, {});
    const title = field(container, "INPUT");
    await type(title, "leaves soon");
    placeCaret(title, 0);
    await act(() => {
      title.dispatchEvent(new Event("focusin", { bubbles: true }));
    });

    await click(findButton(container, "Bus"));

    expect(title.value).toBe("{bus}leaves soon");
    expect(field(container, "TEXTAREA").value).toBe("");
  });

  test("only the details the big event has are offered", async () => {
    const container = await mounter.mount(MessageFields, {
      language: "en",
      onChange: () => undefined,
      placeholders: ["first_name", "room"],
      value: { body: "", title: "" },
    });
    const labels = findElements(
      container,
      (element) => element.tagName === "BUTTON"
    ).map((button) => button.textContent);
    expect(labels).toEqual(["First name", "Room"]);
  });
});

describe("insertAtCursor", () => {
  test("without a known caret the token goes at the end", () => {
    expect(insertAtCursor("Hi", undefined, undefined, "{bus}")).toEqual({
      caret: 7,
      value: "Hi{bus}",
    });
  });

  test("a caret past the end is kept inside the text", () => {
    expect(insertAtCursor("Hi", 10, 12, "{room}")).toEqual({
      caret: 8,
      value: "Hi{room}",
    });
  });
});
