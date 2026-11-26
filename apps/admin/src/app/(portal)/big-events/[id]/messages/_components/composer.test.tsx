import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { PLACEHOLDERS } from "@repo/shared/big-events/messages/text";
import {
  findButton,
  findElements,
  type TestElement,
} from "@/test/react-dom-harness";
import {
  click,
  createMounter,
  installMocks,
  messageActions,
  settle,
  type,
} from "./test-setup";

installMocks();

const previewMessage = spyOn(
  messageActions,
  "previewMessage"
).mockImplementation(async () => ({
  ok: true,
  reach: { email: 4, people: 30, push: 26, sms: 0, unreachable: 0 },
  samples: [],
  warnings: [],
}));
afterAll(() => previewMessage.mockRestore());

const { Composer } = await import("./composer");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());
beforeEach(() => previewMessage.mockClear());

const props = {
  bigEventId: "b1",
  campuses: [{ id: "2", label: "Bergen" }],
  everyoneHelp: "Everyone in this big event",
  groups: [
    { campusId: "2", id: "bus-1", kind: "bus" as const, name: "Bus 1" },
    { campusId: "2", id: "room-1", kind: "room" as const, name: "Ola" },
  ],
  onSent: () => undefined,
  people: [],
  placeholders: PLACEHOLDERS,
  smsEnabled: false,
  travel: true,
};

function isDisabled(element: TestElement): boolean {
  return element.disabled || element.hasAttribute("disabled");
}

function pressed(container: TestElement, label: string): boolean {
  return findButton(container, label).getAttribute("aria-pressed") === "true";
}

describe("Composer", () => {
  test("Message, then Who: a bus is sent to on the way out unless changed (R8)", async () => {
    const container = await mounter.mount(Composer, props);
    expect(isDisabled(findButton(container, "Next"))).toBe(true);
    expect(container.textContent).toContain("Write a title and a text first.");

    const [title] = findElements(container, (e) => e.tagName === "INPUT");
    const [body] = findElements(container, (e) => e.tagName === "TEXTAREA");
    await type(title as TestElement, "Leaving soon");
    await type(body as TestElement, "See you at the bus.");
    await click(findButton(container, "Next"));

    await click(
      findElements(
        container,
        (e) =>
          e.tagName === "BUTTON" &&
          e.textContent.startsWith("Buses, rooms and groups")
      )[0] as TestElement
    );
    expect(container.textContent).not.toContain("Which way?");
    await click(findButton(container, "Bus 1"));

    expect(container.textContent).toContain("Which way?");
    expect(pressed(container, "Way out")).toBe(true);
    await settle(450);
    expect(previewMessage).toHaveBeenLastCalledWith("b1", {
      alsoSms: false,
      audience: { groupIds: ["bus-1"], leg: "out", type: "groups" },
      body: { en: "See you at the bus.", no: "" },
      important: false,
      leg: "out",
      title: { en: "Leaving soon", no: "" },
    });
    expect(container.textContent).toContain(
      "30 people: 26 get a push, 4 get an email"
    );

    await click(findButton(container, "Way home"));
    await settle(450);
    expect(previewMessage.mock.lastCall?.[1].audience).toEqual({
      groupIds: ["bus-1"],
      leg: "home",
      type: "groups",
    });
    expect(isDisabled(findButton(container, "Next"))).toBe(false);
  });
});
