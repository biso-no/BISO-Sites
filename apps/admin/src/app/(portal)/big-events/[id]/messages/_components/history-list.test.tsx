import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { MessageHistoryItem } from "@/lib/big-events/messages/history";
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
  resetToasts,
  settle,
  toast,
} from "./test-setup";

installMocks();

const unpinMessage = spyOn(messageActions, "unpinMessage").mockImplementation(
  async () => ({ ok: true })
);
const cancelMessage = spyOn(messageActions, "cancelMessage").mockImplementation(
  async () => ({ ok: true })
);
const retryMessage = spyOn(messageActions, "retryMessage").mockImplementation(
  async () => ({ ok: true, status: "sent" })
);
afterAll(() => {
  unpinMessage.mockRestore();
  cancelMessage.mockRestore();
  retryMessage.mockRestore();
});

const { HistoryList } = await import("./history-list");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());
const onChanged = mock(async () => undefined);
beforeEach(() => {
  for (const spy of [unpinMessage, cancelMessage, retryMessage, onChanged]) {
    spy.mockClear();
  }
  resetToasts();
});

function item(overrides: Partial<MessageHistoryItem> = {}): MessageHistoryItem {
  return {
    audience: { type: "everyone" },
    automatic: false,
    body: { en: "Body", no: "Tekst" },
    canCancel: false,
    canUnpin: false,
    counts: { email: 15, failed: 0, people: 96, push: 81, sms: 0 },
    id: "m1",
    important: false,
    kind: "manual",
    leg: null,
    messageIds: ["m1"],
    pinned: false,
    retryIds: [],
    scheduledAt: "2027-01-21T08:00:00.000Z",
    sentAt: "2027-01-21T08:01:00.000Z",
    status: "sent",
    title: { en: "Welcome", no: "Velkommen" },
    ...overrides,
  };
}

function entries(container: TestElement): TestElement[] {
  return findElements(container, (element) => element.tagName === "LI");
}

describe("HistoryList", () => {
  test("labels automatic messages and lets an Important one be unpinned", async () => {
    const container = await mounter.mount(HistoryList, {
      items: [
        item({
          audience: { count: 40, type: "people" },
          automatic: true,
          id: "auto-1",
          kind: "bus_assigned",
          messageIds: ["auto-1", "auto-2"],
          title: { en: "Your bus", no: "Bussen din" },
        }),
        item({
          canUnpin: true,
          id: "m2",
          important: true,
          messageIds: ["m2"],
          pinned: true,
          title: { en: "Storm warning", no: "Stormvarsel" },
        }),
      ],
      onChanged,
    });
    const [automatic, important] = entries(container);
    // Screen readers hear what the pin icon shows.
    expect(important?.textContent).toContain("Pinned");
    expect(automatic?.textContent).not.toContain("Pinned");
    expect(automatic?.textContent).toContain("Automatic");
    expect(automatic?.textContent).toContain("Your bus");
    expect(automatic?.textContent).toContain("40 people");
    expect(important?.textContent).not.toContain("Automatic");
    expect(important?.textContent).toContain("Important");
    expect(() => findButton(automatic as TestElement, "Unpin")).toThrow();

    await click(findButton(important as TestElement, "Unpin"));
    await settle();

    expect(unpinMessage).toHaveBeenCalledWith("m2");
    expect(toast.success).toHaveBeenCalledWith(
      "Unpinned. It's no longer at the top."
    );
    expect(onChanged).toHaveBeenCalled();
  });

  test("a sent message shows when it went out, a planned one when it goes (R11)", async () => {
    const container = await mounter.mount(HistoryList, {
      items: [
        item(),
        item({
          counts: { email: 0, failed: 0, people: 0, push: 0, sms: 0 },
          id: "m3",
          scheduledAt: "2027-01-22T17:30:00.000Z",
          sentAt: null,
          status: "scheduled",
        }),
      ],
      onChanged,
    });
    const [sent, planned] = entries(container);
    expect(sent?.textContent).toContain("Sent Thu 21 Jan, 09:01");
    expect(sent?.textContent).toContain("96 people · 81 pushes · 15 emails");
    expect(planned?.textContent).toContain("Goes out Fri 22 Jan, 18:30");
    expect(planned?.textContent).not.toContain("Sent");
  });

  test("Cancel asks first; too late is said plainly and the list is refreshed", async () => {
    cancelMessage.mockImplementationOnce(async () => ({
      error: "already_sent",
      ok: false,
    }));
    const container = await mounter.mount(HistoryList, {
      items: [
        item({
          canCancel: true,
          sentAt: null,
          status: "scheduled",
        }),
      ],
      onChanged,
    });

    await click(findButton(container, "Cancel"));
    expect(container.textContent).toContain(
      "Cancel this message? It won't be sent."
    );
    expect(cancelMessage).not.toHaveBeenCalled();
    await click(findButton(container, "Yes, cancel it"));
    await settle();

    expect(cancelMessage).toHaveBeenCalledWith("m1");
    expect(toast.error).toHaveBeenCalledWith(
      "It's too late to cancel: the message goes out within a minute, or has already gone out."
    );
    expect(onChanged).toHaveBeenCalled();
  });

  test("a failed message offers Try again and says what people get", async () => {
    retryMessage.mockImplementationOnce(async () => ({
      ok: true,
      status: "failed",
    }));
    const container = await mounter.mount(HistoryList, {
      items: [
        item({
          counts: { email: 3, failed: 2, people: 10, push: 5, sms: 0 },
          retryIds: ["m1"],
          sentAt: null,
          status: "failed",
        }),
      ],
      onChanged,
    });
    expect(container.textContent).toContain("Failed");
    expect(container.textContent).toContain("2 not delivered");
    expect(container.textContent).toContain(
      "People not reached yet get the details as they were when it was first sent."
    );

    await click(findButton(container, "Try again"));
    await settle();

    expect(retryMessage).toHaveBeenCalledWith("m1");
    expect(toast.error).toHaveBeenCalledWith(
      "Sending failed again. You can try again later."
    );
    expect(onChanged).toHaveBeenCalled();
  });

  test("SMS are counted as not sent while there is no SMS provider (D9)", async () => {
    const container = await mounter.mount(HistoryList, {
      items: [
        item({ counts: { email: 3, failed: 0, people: 4, push: 1, sms: 2 } }),
      ],
      onChanged,
    });
    expect(container.textContent).toContain("2 SMS not sent (no SMS provider)");
  });

  test("says so when there are no messages yet", async () => {
    const container = await mounter.mount(HistoryList, {
      items: [],
      onChanged,
    });
    expect(container.textContent).toBe("No messages yet.");
  });
});
