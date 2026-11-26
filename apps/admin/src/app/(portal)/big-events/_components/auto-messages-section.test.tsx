import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { defaultAutoTexts } from "@repo/shared/big-events/messages/text";
import { createElement, useState } from "react";
import {
  type AutoTextsForm,
  autoTextsForm,
} from "@/lib/big-events/auto-message-texts";
import {
  findButton,
  findElements,
  type TestElement,
} from "@/test/react-dom-harness";
import {
  click,
  createMounter,
  installMocks,
} from "../[id]/messages/_components/test-setup";

installMocks();

const { AutoMessagesSection } = await import("./auto-messages-section");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());

const defaults = (): AutoTextsForm =>
  structuredClone(autoTextsForm(defaultAutoTexts));
const onSwitch = mock((_key: string, _value: boolean): undefined => undefined);

function Section({ start }: { start: AutoTextsForm }) {
  const [texts, setTexts] = useState(start);
  return createElement(AutoMessagesSection, {
    defaults: defaults(),
    onSwitch,
    onTexts: setTexts,
    switches: {
      auto_bus_assigned: true,
      auto_bus_moved: true,
      auto_departure_reminder: true,
    },
    texts,
    travel: true,
  });
}

function editors(container: TestElement): TestElement[] {
  return findElements(container, (element) => element.tagName === "DETAILS");
}

describe("AutoMessagesSection", () => {
  test("three switches, each turned off on its own", async () => {
    const container = await mounter.mount(Section, { start: defaults() });
    const switches = findElements(
      container,
      (element) => element.getAttribute("role") === "switch"
    );
    expect(switches).toHaveLength(3);
    expect(container.textContent).toContain("Your bus");
    expect(container.textContent).toContain("Bus changes");
    expect(container.textContent).toContain("Departure reminder");

    await click(switches[2] as TestElement);
    expect(onSwitch).toHaveBeenCalledWith("auto_departure_reminder", false);
  });

  test("Reset to default clears one kind's own text", async () => {
    const start = defaults();
    start.bus_moved.no.title = "Du har fått ny buss";
    const container = await mounter.mount(Section, { start });
    const [assigned, moved] = editors(container);
    expect(moved?.textContent).toContain("Your own text");
    expect(assigned?.textContent).not.toContain("Your own text");
    const title = findElements(
      moved as TestElement,
      (element) => element.tagName === "INPUT"
    )[0];
    expect(title?.value).toBe("Du har fått ny buss");

    await click(findButton(moved as TestElement, "Reset to default"));

    expect(title?.value).toBe(defaultAutoTexts("bus_moved").no.title);
    expect(moved?.textContent).not.toContain("Your own text");
  });
});
