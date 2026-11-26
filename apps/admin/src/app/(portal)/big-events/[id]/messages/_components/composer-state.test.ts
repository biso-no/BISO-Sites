import { describe, expect, test } from "bun:test";
import { AUDIENCE_IDS_MAX } from "@/lib/big-events/messages/draft";
import {
  addCapped,
  type ComposerState,
  draftOf,
  emptyComposer,
  hasText,
  otherLocale,
  showsLeg,
  textsComplete,
  toggleCapped,
} from "./composer-state";

const busIds = new Set(["bus-1"]);

function state(overrides: Partial<ComposerState> = {}): ComposerState {
  return { ...emptyComposer(), ...overrides };
}

const written = {
  body: { en: "Hi {first name}", no: "" },
  title: { en: "Hello", no: "" },
};

describe("draftOf", () => {
  test("is null until someone is chosen", () => {
    expect(draftOf(state(), { busIds, travel: true })).toBeNull();
    expect(
      draftOf(state({ audienceType: "campus" }), { busIds, travel: true })
    ).toBeNull();
    expect(
      draftOf(state({ audienceType: "people" }), { busIds, travel: true })
    ).toBeNull();
  });

  test("everyone, with the texts, Important and SMS as chosen", () => {
    const draft = draftOf(
      state({
        alsoSms: true,
        audienceType: "everyone",
        important: true,
        texts: written,
      }),
      { busIds, travel: false }
    );
    expect(draft).toEqual({
      alsoSms: true,
      audience: { type: "everyone" },
      body: written.body,
      important: true,
      title: written.title,
    });
  });

  test("a bus audience always carries the leg, the way out by default (R8)", () => {
    const draft = draftOf(
      state({ audienceType: "groups", groupIds: ["bus-1", "room-1"] }),
      { busIds, travel: true }
    );
    expect(draft?.audience).toEqual({
      groupIds: ["bus-1", "room-1"],
      leg: "out",
      type: "groups",
    });
    expect(draft?.leg).toBe("out");

    const home = draftOf(
      state({ audienceType: "groups", groupIds: ["bus-1"], leg: "home" }),
      { busIds, travel: true }
    );
    expect(home?.audience).toEqual({
      groupIds: ["bus-1"],
      leg: "home",
      type: "groups",
    });
  });

  test("rooms only: no leg unless the text names bus details", () => {
    const rooms = state({ audienceType: "groups", groupIds: ["room-1"] });
    expect(draftOf(rooms, { busIds, travel: true })).toEqual({
      alsoSms: false,
      audience: { groupIds: ["room-1"], type: "groups" },
      body: { en: "", no: "" },
      important: false,
      title: { en: "", no: "" },
    });
    const withBus = draftOf(
      {
        ...rooms,
        leg: "home",
        texts: { ...rooms.texts, body: { en: "{bus}", no: "" } },
      },
      { busIds, travel: true }
    );
    expect(withBus?.leg).toBe("home");
    expect(withBus?.audience).toEqual({ groupIds: ["room-1"], type: "groups" });
  });

  test("campus and chosen people", () => {
    expect(
      draftOf(state({ audienceType: "campus", campusIds: ["2"] }), {
        busIds,
        travel: false,
      })?.audience
    ).toEqual({ campusIds: ["2"], type: "campus" });
    expect(
      draftOf(state({ audienceType: "people", participantIds: ["p1"] }), {
        busIds,
        travel: false,
      })?.audience
    ).toEqual({ participantIds: ["p1"], type: "people" });
  });
});

describe("showsLeg", () => {
  test("only with Travel on, for a bus or bus details in the text", () => {
    const bus = state({ audienceType: "groups", groupIds: ["bus-1"] });
    expect(showsLeg(bus, busIds, true)).toBe(true);
    expect(showsLeg(bus, busIds, false)).toBe(false);
    expect(showsLeg(state({ audienceType: "everyone" }), busIds, true)).toBe(
      false
    );
    expect(
      showsLeg(
        state({
          audienceType: "everyone",
          texts: {
            body: { en: "", no: "{avgang}" },
            title: { en: "", no: "" },
          },
        }),
        busIds,
        true
      )
    ).toBe(true);
  });
});

describe("texts", () => {
  test("hasText needs both a title and a text in that language", () => {
    expect(hasText(written, "en")).toBe(true);
    expect(hasText(written, "no")).toBe(false);
    expect(
      hasText({ body: { en: "  ", no: "" }, title: { en: "A", no: "" } }, "en")
    ).toBe(false);
  });

  test("textsComplete needs both languages", () => {
    expect(textsComplete(written)).toBe(false);
    expect(
      textsComplete({
        body: { en: "b", no: "b" },
        title: { en: "t", no: "t" },
      })
    ).toBe(true);
  });

  test("otherLocale", () => {
    expect(otherLocale("no")).toBe("en");
    expect(otherLocale("en")).toBe("no");
  });
});

describe("addCapped", () => {
  test("adds once and never past the cap", () => {
    expect(addCapped(["a"], "a")).toEqual(["a"]);
    expect(addCapped(["a"], "b")).toEqual(["a", "b"]);
    const full = Array.from({ length: AUDIENCE_IDS_MAX }, (_, i) => `p${i}`);
    expect(addCapped(full, "extra")).toBe(full);
  });
});

describe("toggleCapped", () => {
  test("takes a chosen id out and adds a new one", () => {
    expect(toggleCapped(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleCapped(["b"], "a")).toEqual(["b", "a"]);
  });
});
