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
import { PLACEHOLDERS } from "@repo/shared/big-events/messages/text";
import { createElement, useState } from "react";
import type { MessageLocale } from "@/lib/big-events/messages/draft";
import {
  findButton,
  findByAriaLabel,
  findElements,
  type TestElement,
} from "@/test/react-dom-harness";
import type { ComposerTexts, TextField } from "./composer-state";
import {
  click,
  createMounter,
  installMocks,
  messageActions,
  resetToasts,
  settle,
  toast,
  type,
} from "./test-setup";

installMocks();

import type { MessagePreview } from "./use-message-preview";

const sendBigEventMessage = spyOn(
  messageActions,
  "sendBigEventMessage"
).mockImplementation(async () => ({
  messageId: "m1",
  ok: true,
  people: 3,
  status: "sent",
}));
const translateMessage = spyOn(
  messageActions,
  "translateMessage"
).mockImplementation(async () => ({
  body: "Hei {fornavn}, bussen går {avgang}.",
  ok: true,
  title: "Bussen går snart",
}));
afterAll(() => {
  sendBigEventMessage.mockRestore();
  translateMessage.mockRestore();
});

const { CheckStep } = await import("./check-step");

const mounter = createMounter();
afterEach(() => mounter.unmount());
afterAll(() => mounter.restore());
beforeEach(() => {
  sendBigEventMessage.mockClear();
  translateMessage.mockClear();
  onSent.mockClear();
  resetToasts();
});

const NOW = new Date("2027-01-20T12:00:00.000Z");
const onSent = mock(() => undefined);

const englishOnly: ComposerTexts = {
  body: { en: "Hi {first name}, the bus leaves {departure}.", no: "" },
  title: { en: "Your bus leaves soon", no: "" },
};
const both: ComposerTexts = {
  body: { en: englishOnly.body.en, no: "Hei {fornavn}." },
  title: { en: englishOnly.title.en, no: "Bussen går snart" },
};

const preview: MessagePreview = {
  answer: {
    kind: "ready",
    reach: { email: 1, people: 3, push: 2, sms: 0, unreachable: 0 },
    samples: [
      {
        label: "Bus 1",
        text: {
          en: { body: "Hi Ola, the bus leaves Fri 24 Jan, 14:00.", title: "T" },
          no: { body: "Hei Ola.", title: "Bussen går snart" },
        },
      },
    ],
    warnings: ["Bus 2 has no meeting point for the way out yet"],
  },
  idle: false,
  pending: false,
};

function Check({ start }: { start: ComposerTexts }) {
  const [texts, setTexts] = useState(start);
  return createElement(CheckStep, {
    bigEventId: "b1",
    draftId: "draft-1",
    draft: {
      alsoSms: false,
      audience: { type: "everyone" },
      body: texts.body,
      important: false,
      title: texts.title,
    },
    locale: "en",
    now: () => NOW,
    onBack: () => undefined,
    onSent,
    onTextChange: (language: MessageLocale, field: TextField, value: string) =>
      setTexts((previous) => ({
        ...previous,
        [field]: { ...previous[field], [language]: value },
      })),
    placeholders: PLACEHOLDERS,
    preview,
    texts,
  });
}

function isDisabled(element: TestElement): boolean {
  return element.disabled || element.hasAttribute("disabled");
}

function fields(container: TestElement, tagName: string): TestElement[] {
  return findElements(container, (element) => element.tagName === tagName);
}

async function scheduleAt(
  container: TestElement,
  date: string,
  time: string
): Promise<void> {
  await click(findButton(container, "Schedule"));
  await type(findByAriaLabel(container, "Date"), date);
  await type(findByAriaLabel(container, "Time (Oslo)"), time);
}

describe("CheckStep", () => {
  test("needs both languages before it can send", async () => {
    const container = await mounter.mount(Check, { start: englishOnly });
    expect(isDisabled(findButton(container, "Send message"))).toBe(true);
    expect(container.textContent).toContain(
      "Write the title and text in both Norwegian and English."
    );

    // Norwegian comes first, then English: fill the Norwegian title and text.
    const [norwegianTitle] = fields(container, "INPUT");
    const [norwegianBody] = fields(container, "TEXTAREA");
    await type(norwegianTitle as TestElement, "Bussen går snart");
    await type(norwegianBody as TestElement, "Hei {fornavn}.");

    expect(isDisabled(findButton(container, "Send message"))).toBe(false);
    expect(container.textContent).not.toContain(
      "Write the title and text in both Norwegian and English."
    );
  });

  test("Translate fills the other language, which stays editable", async () => {
    const container = await mounter.mount(Check, { start: englishOnly });
    await click(findButton(container, "Translate"));
    await settle();

    expect(translateMessage).toHaveBeenCalledWith("b1", {
      body: englishOnly.body.en,
      from: "en",
      title: englishOnly.title.en,
    });
    const [norwegianTitle] = fields(container, "INPUT");
    const [norwegianBody] = fields(container, "TEXTAREA");
    expect(norwegianTitle?.value).toBe("Bussen går snart");
    expect(norwegianBody?.value).toBe("Hei {fornavn}, bussen går {avgang}.");
    expect(isDisabled(findButton(container, "Send message"))).toBe(false);
  });

  test("shows one sample in both languages and the warnings", async () => {
    const container = await mounter.mount(Check, { start: both });
    const text = container.textContent;
    expect(text).toContain("Bus 1");
    expect(text).toContain("Hei Ola.");
    expect(text).toContain("Hi Ola, the bus leaves Fri 24 Jan, 14:00.");
    expect(text).toContain("Bus 2 has no meeting point for the way out yet");
    expect(text).toContain("3 people: 2 get a push, 1 gets an email");
  });

  test("a time in the past is refused with a plain sentence", async () => {
    const container = await mounter.mount(Check, { start: both });
    await scheduleAt(container, "2027-01-20", "12:30");

    await click(findButton(container, "Schedule message"));

    expect(container.textContent).toContain(
      "That time has passed. Pick a later time."
    );
    expect(sendBigEventMessage).not.toHaveBeenCalled();
  });

  test("a later Oslo time is sent as that instant", async () => {
    sendBigEventMessage.mockImplementationOnce(async () => ({
      messageId: "m1",
      ok: true,
      people: 3,
      status: "scheduled",
    }));
    const container = await mounter.mount(Check, { start: both });
    await scheduleAt(container, "2027-01-21", "09:00");

    await click(findButton(container, "Schedule message"));
    await settle();

    expect(sendBigEventMessage.mock.calls[0]?.[2]).toEqual({
      at: "2027-01-21T08:00:00.000Z",
    });
    expect(toast.success).toHaveBeenCalledWith("Planned for Thu 21 Jan, 09:00");
    expect(onSent).toHaveBeenCalled();
  });

  test("a refusal is a sentence, never a code", async () => {
    sendBigEventMessage.mockImplementationOnce(async () => ({
      error: "no_people",
      ok: false,
    }));
    const container = await mounter.mount(Check, { start: both });
    await click(findButton(container, "Send message"));
    await settle();

    expect(container.textContent).toContain(
      "Nobody matches who you chose. Choose someone else."
    );
    expect(container.textContent).not.toContain("no_people");
  });

  test("sends with the draft's own id, so a repeat can't send twice (R35)", async () => {
    const container = await mounter.mount(Check, { start: both });
    await click(findButton(container, "Send message"));
    await settle();

    expect(sendBigEventMessage.mock.calls[0]?.[3]).toBe("draft-1");
  });

  test("an unexpected error asks to check the list before sending again", async () => {
    sendBigEventMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("network"))
    );
    const container = await mounter.mount(Check, { start: both });
    await click(findButton(container, "Send message"));
    await settle();

    expect(container.textContent).toContain(
      "Something went wrong. Check the list below before you send it again."
    );
    expect(onSent).not.toHaveBeenCalled();
  });

  test("Send waits for Translate, and Translate for Send", async () => {
    let finishTranslating: () => void = () => undefined;
    translateMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishTranslating = () =>
            resolve({ body: "Hei.", ok: true, title: "Hei" });
        })
    );
    const container = await mounter.mount(Check, { start: both });
    await click(findButton(container, "Translate"));
    expect(isDisabled(findButton(container, "Send message"))).toBe(true);
    finishTranslating();
    await settle();
    expect(isDisabled(findButton(container, "Send message"))).toBe(false);

    let finishSending: () => void = () => undefined;
    sendBigEventMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSending = () =>
            resolve({ messageId: "m1", ok: true, people: 3, status: "sent" });
        })
    );
    await click(findButton(container, "Send message"));
    expect(isDisabled(findButton(container, "Translate"))).toBe(true);
    finishSending();
    await settle();
  });

  test("samples and warnings with the same name all show", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    const twice: MessagePreview = {
      ...preview,
      answer: {
        kind: "ready",
        reach: { email: 2, people: 2, push: 0, sms: 0, unreachable: 0 },
        samples: [
          {
            label: "Buss 1",
            text: {
              en: { body: "A", title: "T" },
              no: { body: "A", title: "T" },
            },
          },
          {
            label: "Buss 1",
            text: {
              en: { body: "B", title: "T" },
              no: { body: "B", title: "T" },
            },
          },
        ],
        warnings: [
          "Buss 1 has no meeting point",
          "Buss 1 has no meeting point",
        ],
      },
    };
    const container = await mounter.mount(
      () =>
        createElement(CheckStep, {
          bigEventId: "b1",
          draft: {
            alsoSms: false,
            audience: { type: "everyone" },
            body: both.body,
            important: false,
            title: both.title,
          },
          draftId: "draft-1",
          locale: "en",
          now: () => NOW,
          onBack: () => undefined,
          onSent,
          onTextChange: () => undefined,
          placeholders: PLACEHOLDERS,
          preview: twice,
          texts: both,
        }),
      {}
    );
    const keyWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes("same key")
    );
    consoleError.mockRestore();
    expect(keyWarnings).toEqual([]);
    expect(
      findElements(container, (element) => element.tagName === "ARTICLE")
    ).toHaveLength(2);
  });

  test("a send that failed says so and points to the history", async () => {
    sendBigEventMessage.mockImplementationOnce(async () => ({
      messageId: "m1",
      ok: true,
      people: 3,
      status: "failed",
    }));
    const container = await mounter.mount(Check, { start: both });
    await click(findButton(container, "Send message"));
    await settle();

    expect(sendBigEventMessage.mock.calls[0]?.[2]).toEqual({ at: "now" });
    expect(toast.error).toHaveBeenCalledWith(
      "Sending failed. You can try again from the list below."
    );
  });
});
