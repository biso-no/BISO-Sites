import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import type { ReachSummary } from "@repo/shared/big-events/messages/plan";
import { act, createElement, useState } from "react";
import type { MessageDraft } from "@/lib/big-events/messages/draft";
import {
  createMounter,
  installMocks,
  messageActions,
  settle,
} from "./test-setup";

installMocks();

const previewMessage = spyOn(
  messageActions,
  "previewMessage"
).mockImplementation(async () => ({
  ok: true,
  reach: reach({ email: 1, people: 2, push: 1 }),
  samples: [],
  warnings: [],
}));
afterAll(() => previewMessage.mockRestore());

const { ReachBox } = await import("./reach-box");
const { useMessagePreview } = await import("./use-message-preview");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());
beforeEach(() => previewMessage.mockClear());

function reach(overrides: Partial<ReachSummary> = {}): ReachSummary {
  return {
    email: 0,
    people: 0,
    push: 0,
    sms: 0,
    unreachable: 0,
    ...overrides,
  };
}

function ready(summary: ReachSummary) {
  return {
    answer: {
      kind: "ready" as const,
      reach: summary,
      samples: [],
      warnings: [],
    },
    idle: false,
    pending: false,
  };
}

describe("ReachBox", () => {
  test("shows who gets a push and who gets an email", async () => {
    const container = await mounter.mount(ReachBox, {
      preview: ready(
        reach({ email: 15, people: 96, push: 81, unreachable: 3 })
      ),
    });
    expect(container.textContent).toContain(
      "96 people: 81 get a push, 15 get an email"
    );
    expect(container.textContent).toContain("3 can't be reached (no email)");
    expect(container.textContent).not.toContain("SMS");
  });

  test("adds the SMS count when SMS is on, and nothing about the unreachable when everyone is reached", async () => {
    const container = await mounter.mount(ReachBox, {
      preview: ready(reach({ email: 15, people: 96, push: 81, sms: 96 })),
    });
    expect(container.textContent).toContain("96 get an SMS");
    expect(container.textContent).not.toContain("can't be reached");
  });

  test("asks for an audience first, and says plainly why it can't count", async () => {
    const idle = await mounter.mount(ReachBox, {
      preview: { answer: null, idle: true, pending: false },
    });
    expect(idle.textContent).toBe(
      "Choose who gets the message to see how many it reaches."
    );
    await mounter.unmount();

    const refused = await mounter.mount(ReachBox, {
      preview: {
        answer: { error: "unknown_placeholder", kind: "refused" },
        idle: false,
        pending: false,
      },
    });
    expect(refused.textContent).toContain(
      "Something in curly brackets isn't a detail we can fill in."
    );
    expect(refused.textContent).not.toContain("unknown_placeholder");
  });
});

describe("useMessagePreview", () => {
  let setDraft: (draft: MessageDraft | null) => void = () => undefined;
  function Probe() {
    const [draft, set] = useState<MessageDraft | null>(null);
    setDraft = set;
    return createElement(ReachBox, {
      preview: useMessagePreview("b1", draft),
    });
  }

  function draft(title: string): MessageDraft {
    return {
      alsoSms: false,
      audience: { type: "everyone" },
      body: { en: "", no: "" },
      important: false,
      title: { en: title, no: "" },
    };
  }

  test("counts once the draft has settled for a moment", async () => {
    const container = await mounter.mount(Probe, {});
    expect(previewMessage).not.toHaveBeenCalled();

    await act(() => setDraft(draft("H")));
    await act(() => setDraft(draft("Hi")));
    expect(container.textContent).toBe("Counting…");
    expect(previewMessage).not.toHaveBeenCalled();

    await settle(450);
    expect(previewMessage).toHaveBeenCalledTimes(1);
    expect(previewMessage.mock.calls[0]).toEqual(["b1", draft("Hi")]);
    expect(container.textContent).toContain(
      "2 people: 1 gets a push, 1 gets an email"
    );
  });
});
