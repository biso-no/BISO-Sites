import { describe, expect, test } from "bun:test";
import type { LocalizedVars } from "@repo/shared/big-events/messages/plan";
import type { MessageTexts } from "./draft";
import {
  type MessageWarning,
  messageSamples,
  messageWarnings,
  type WarningBus,
  warningTexts,
} from "./preview";

const LABELS = { everyone: "Alle", noBus: "Ingen buss", noRoom: "Ikke på rom" };

function texts(no: string, en = no, title = "Info"): MessageTexts {
  return { body: { en, no }, title: { en: title, no: title } };
}

function person(no: LocalizedVars["no"], en = no): { vars: LocalizedVars } {
  return { vars: { en, no } };
}

describe("messageSamples (R23)", () => {
  test("one sample for everyone when only the first name differs", () => {
    const samples = messageSamples({
      labels: LABELS,
      locale: "no",
      people: [person({ first_name: "Kari" }), person({ first_name: "Ola" })],
      texts: texts("Hei {fornavn}!", "Hi {first name}!"),
    });
    expect(samples).toEqual([
      {
        label: "Alle",
        text: {
          en: { body: "Hi Kari!", title: "Info" },
          no: { body: "Hei Kari!", title: "Info" },
        },
      },
    ]);
  });

  test("one sample per bus, named after it, and one for people without", () => {
    const samples = messageSamples({
      labels: LABELS,
      locale: "no",
      people: [
        person({ bus: "Buss 1", first_name: "Kari" }),
        person({ bus: "Buss 1", first_name: "Ola" }),
        person({ bus: "Buss 2", first_name: "Per" }),
        person({ first_name: "Anne" }),
      ],
      texts: texts("Du skal med {buss}."),
    });
    expect(samples.map((sample) => sample.label)).toEqual([
      "Buss 1",
      "Buss 2",
      "Ingen buss",
    ]);
    expect(samples[1]?.text.no.body).toBe("Du skal med Buss 2.");
  });

  test("labels name the room in the admin's language, and both", () => {
    const people = [
      person(
        { bus: "Buss 1", room: "Rom · Kari N" },
        { bus: "Buss 1", room: "Room · Kari N" }
      ),
      person({ bus: "Buss 1" }),
    ];
    const samples = messageSamples({
      labels: { ...LABELS, noRoom: "Not in a room" },
      locale: "en",
      people,
      texts: texts("{buss}, {rom}"),
    });
    expect(samples.map((sample) => sample.label)).toEqual([
      "Buss 1 · Room · Kari N",
      "Buss 1 · Not in a room",
    ]);
  });

  test("at most five samples", () => {
    const people = Array.from({ length: 8 }, (_, index) =>
      person({ bus: `Buss ${index}` })
    );
    const samples = messageSamples({
      labels: LABELS,
      locale: "no",
      people,
      texts: texts("{avgang} {buss}"),
    });
    expect(samples).toHaveLength(5);
  });

  test("nobody in the audience gives no samples", () => {
    expect(
      messageSamples({
        labels: LABELS,
        locale: "no",
        people: [],
        texts: texts("Hei"),
      })
    ).toEqual([]);
  });
});

function bus(name: string, fields: Partial<WarningBus> = {}): WarningBus {
  return {
    campus_id: "2",
    contact_name: "Kari",
    contact_phone: null,
    home_departs_at: "2027-01-27T15:00:00.000Z",
    home_meeting_point: "Hotellet",
    name,
    out_departs_at: "2027-01-24T07:00:00.000Z",
    out_meeting_point: "BI Bergen",
    ...fields,
  };
}

describe("messageWarnings (M5, R23)", () => {
  const buses = new Map<string, WarningBus>([
    ["b2", bus("Buss 2", { out_meeting_point: " " })],
    ["b10", bus("Buss 10", { contact_name: null, out_departs_at: null })],
    ["b3", bus("Buss 3", { campus_id: "1", out_meeting_point: null })],
  ]);
  const members = [
    { group_id: "b2", leg: "out" as const, participant_id: "p1" },
    { group_id: "b10", leg: "out" as const, participant_id: "p2" },
    { group_id: "b10", leg: "home" as const, participant_id: "p3" },
    // Another campus's bus is never theirs (Stage 2 R19).
    { group_id: "b3", leg: "out" as const, participant_id: "p4" },
    { group_id: "r1", leg: null, participant_id: "p1" },
  ];
  const people = ["p1", "p2", "p3", "p4"].map(($id) => ({
    $id,
    campus_id: "2",
  }));

  test("names buses missing a detail the text uses, and people without a bus", () => {
    const warnings = messageWarnings({
      buses,
      leg: "out",
      members,
      people,
      roomIds: new Set(["r1"]),
      uses: new Set(["meeting_point", "departure", "bus_contact"]),
    });
    expect(warnings).toEqual([
      { bus: "Buss 2", kind: "no_meeting_point" },
      { bus: "Buss 10", kind: "no_departure" },
      { bus: "Buss 10", kind: "no_contact" },
      { count: 2, kind: "people_without_bus" },
    ]);
  });

  test("checks the message's leg", () => {
    const warnings = messageWarnings({
      buses,
      leg: "home",
      members,
      people,
      roomIds: new Set(["r1"]),
      uses: new Set(["departure"]),
    });
    expect(warnings).toEqual([{ count: 3, kind: "people_without_bus" }]);
  });

  test("people without a room when the text uses the room", () => {
    const warnings = messageWarnings({
      buses,
      leg: "out",
      members,
      people,
      roomIds: new Set(["r1"]),
      uses: new Set(["room", "first_name"]),
    });
    expect(warnings).toEqual([{ count: 3, kind: "people_without_room" }]);
  });

  test("the trip home is a bus detail: people without a bus are counted", () => {
    const warnings = messageWarnings({
      buses,
      leg: "out",
      members,
      people,
      roomIds: new Set(),
      uses: new Set(["trip_home"]),
    });
    expect(warnings).toEqual([{ count: 2, kind: "people_without_bus" }]);
  });

  test("no bus or room placeholder, no warnings", () => {
    expect(
      messageWarnings({
        buses,
        leg: "out",
        members,
        people,
        roomIds: new Set(),
        uses: new Set(["first_name"]),
      })
    ).toEqual([]);
  });
});

describe("warningTexts", () => {
  test("turns each warning into the admin's copy", () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const t = (key: string, values?: Record<string, string | number>) => {
      calls.push([key, values]);
      return key;
    };
    const warnings: MessageWarning[] = [
      { bus: "Buss 3", kind: "no_meeting_point" },
      { count: 2, kind: "people_without_bus" },
    ];
    expect(warningTexts(warnings, "home", t)).toEqual([
      "warnings.noMeetingPoint",
      "warnings.peopleWithoutBus",
    ]);
    expect(calls).toEqual([
      ["warnings.noMeetingPoint", { bus: "Buss 3", leg: "home" }],
      ["warnings.peopleWithoutBus", { count: 2, leg: "home" }],
    ]);
  });
});
