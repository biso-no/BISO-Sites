import { describe, expect, test } from "bun:test";
import {
  checkDraftTexts,
  type MessageDraft,
  messageDraftSchema,
  messageLeg,
  sendTime,
  usedPlaceholders,
} from "./draft";

const NOW = new Date("2027-01-20T12:00:00.000Z");

describe("checkDraftTexts", () => {
  test("trims the texts and keeps both languages", () => {
    const result = checkDraftTexts(
      {
        body: { en: " Hi {first name}! ", no: "Hei {fornavn}!\n" },
        title: { en: "Bus", no: "Buss" },
      },
      { complete: true }
    );
    expect(result).toEqual({
      ok: true,
      texts: {
        body: { en: "Hi {first name}!", no: "Hei {fornavn}!" },
        title: { en: "Bus", no: "Buss" },
      },
    });
  });

  test("an unknown placeholder in any text is refused", () => {
    for (const text of [
      { body: { no: "Hei {navn}" }, title: { no: "Buss" } },
      { body: { en: "Hi" }, title: { en: "{bus number}" } },
    ]) {
      expect(checkDraftTexts(text, { complete: false })).toEqual({
        error: "unknown_placeholder",
        ok: false,
      });
    }
  });

  test("placeholders of either language are accepted in either text", () => {
    const result = checkDraftTexts(
      {
        body: { en: "{buss} {avgang}", no: "{bus} {meeting point}" },
        title: { en: "x", no: "y" },
      },
      { complete: true }
    );
    expect(result.ok).toBe(true);
  });

  test("sending needs the title and the text in both languages", () => {
    const missing = [
      { body: { en: "Hi", no: "Hei" }, title: { no: "Buss" } },
      { body: { en: "  ", no: "Hei" }, title: { en: "Bus", no: "Buss" } },
      { body: {}, title: {} },
    ];
    for (const text of missing) {
      expect(checkDraftTexts(text, { complete: true })).toEqual({
        error: "missing_translation",
        ok: false,
      });
    }
  });

  test("a preview works with one language", () => {
    const result = checkDraftTexts(
      { body: { no: "Hei" }, title: { no: "Buss" } },
      { complete: false }
    );
    expect(result).toEqual({
      ok: true,
      texts: { body: { en: "", no: "Hei" }, title: { en: "", no: "Buss" } },
    });
  });
});

describe("usedPlaceholders", () => {
  test("collects the placeholders of every text", () => {
    const used = usedPlaceholders({
      body: { en: "{departure}", no: "{oppmøtested}" },
      title: { en: "", no: "{Fornavn}" },
    });
    expect([...used].sort()).toEqual([
      "departure",
      "first_name",
      "meeting_point",
    ]);
  });
});

describe("messageLeg (R13, R8)", () => {
  const buses = new Set(["bus-1"]);

  test("a bus audience without a leg is for the way out, stored on both", () => {
    expect(
      messageLeg(
        { groupIds: ["bus-1", "room-1"], type: "groups" },
        undefined,
        buses
      )
    ).toEqual({
      audience: { groupIds: ["bus-1", "room-1"], leg: "out", type: "groups" },
      leg: "out",
    });
  });

  test("the audience's leg wins and is the message's leg", () => {
    expect(
      messageLeg(
        { groupIds: ["bus-1"], leg: "home", type: "groups" },
        "out",
        buses
      )
    ).toEqual({
      audience: { groupIds: ["bus-1"], leg: "home", type: "groups" },
      leg: "home",
    });
  });

  test("rooms only: no leg unless the draft names one", () => {
    expect(
      messageLeg({ groupIds: ["room-1"], type: "groups" }, undefined, buses)
    ).toEqual({
      audience: { groupIds: ["room-1"], type: "groups" },
      leg: null,
    });
    expect(
      messageLeg({ groupIds: ["room-1"], type: "groups" }, "home", buses)
    ).toEqual({
      audience: { groupIds: ["room-1"], leg: "home", type: "groups" },
      leg: "home",
    });
  });

  test("other audiences keep the draft's leg for the bus details", () => {
    expect(messageLeg({ type: "everyone" }, "home", buses)).toEqual({
      audience: { type: "everyone" },
      leg: "home",
    });
    expect(messageLeg({ type: "everyone" }, undefined, buses)).toEqual({
      audience: { type: "everyone" },
      leg: null,
    });
  });
});

describe("sendTime", () => {
  test("now sends right away", () => {
    expect(sendTime({ at: "now" }, NOW)).toEqual({
      at: NOW.toISOString(),
      immediate: true,
      ok: true,
    });
  });

  test("a time in the future is scheduled", () => {
    expect(sendTime({ at: "2027-01-20T15:00:00+01:00" }, NOW)).toEqual({
      at: "2027-01-20T14:00:00.000Z",
      immediate: false,
      ok: true,
    });
  });

  test("scheduling in the past is refused after a minute of grace", () => {
    expect(sendTime({ at: "2027-01-20T11:59:30.000Z" }, NOW).ok).toBe(true);
    expect(sendTime({ at: "2027-01-20T11:59:00.000Z" }, NOW).ok).toBe(true);
    expect(sendTime({ at: "2027-01-20T11:58:59.000Z" }, NOW)).toEqual({
      error: "in_the_past",
      ok: false,
    });
  });
});

describe("messageDraftSchema", () => {
  const draft: MessageDraft = {
    alsoSms: false,
    audience: { type: "everyone" },
    body: { no: "Hei" },
    important: false,
    title: { no: "Buss" },
  };

  test("accepts a draft", () => {
    expect(messageDraftSchema.parse(draft)).toEqual(draft);
  });

  test("refuses texts longer than their columns", () => {
    expect(() =>
      messageDraftSchema.parse({ ...draft, title: { no: "x".repeat(201) } })
    ).toThrow();
    expect(() =>
      messageDraftSchema.parse({ ...draft, body: { en: "x".repeat(2001) } })
    ).toThrow();
  });

  test("an audience must fit its column", () => {
    const ids = Array.from({ length: 101 }, (_, index) => `p${index}`);
    expect(() =>
      messageDraftSchema.parse({
        ...draft,
        audience: { participantIds: ids, type: "people" },
      })
    ).toThrow();
    expect(() =>
      messageDraftSchema.parse({
        ...draft,
        audience: { participantIds: [], type: "people" },
      })
    ).toThrow();
  });
});
