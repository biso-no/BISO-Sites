import { describe, expect, it } from "vitest";
import type { GroupLeg } from "../tables";
import type { BigEventGroupRow } from "../types";
import {
  type DeliveryRecipient,
  deliveryRecipients,
  parseStoredVars,
  planDelivery,
  reachSummary,
  serializeVars,
  type VarsBus,
  varsFor,
} from "./plan";

// ── varsFor ───────────────────────────────────────────────────────────────────

function busRow(id: string, fields: Partial<BigEventGroupRow>): VarsBus {
  return {
    campus_id: "1",
    contact_name: null,
    contact_phone: null,
    home_departs_at: null,
    home_meeting_point: null,
    name: id,
    out_departs_at: null,
    out_meeting_point: null,
    ...fields,
  };
}

const buses = new Map<string, VarsBus>([
  [
    "bus-1",
    busRow("bus-1", {
      contact_name: "Kari Nordmann",
      contact_phone: "912 34 567",
      home_departs_at: "2025-01-26T10:30:00.000Z",
      home_meeting_point: "Hafjell hotell",
      name: "Buss 1",
      // Friday 24 January 2025, 14:00 in Oslo (UTC+1 in winter).
      out_departs_at: "2025-01-24T13:00:00.000Z",
      out_meeting_point: "Nydalen T",
    }),
  ],
  [
    "bus-2",
    busRow("bus-2", {
      contact_name: "Per Hansen",
      // Sunday 26 January 2025, 12:15 in Oslo.
      home_departs_at: "2025-01-26T11:15:00.000Z",
      name: "Buss 2",
    }),
  ],
  [
    "bus-bergen",
    busRow("bus-bergen", {
      campus_id: "2",
      name: "Bergen-bussen",
      out_departs_at: "2025-01-24T12:00:00.000Z",
      out_meeting_point: "Bryggen",
    }),
  ],
]);

const rooms = new Map([
  ["room-1", { name: "Ola Nordmann", room_number: "312" }],
  ["room-2", { name: "Kari Nordmann", room_number: null }],
]);

function seat(groupId: string, participantId: string, leg: GroupLeg | null) {
  return { group_id: groupId, leg, participant_id: participantId };
}

const members = [
  seat("bus-1", "p-ola", "out"),
  seat("bus-2", "p-ola", "home"),
  seat("room-1", "p-ola", null),
  seat("bus-2", "p-kari", "out"),
  seat("bus-1", "p-kari", "home"),
  seat("room-2", "p-kari", null),
  seat("buddy-1", "p-kari", null),
  // A stale seat on another campus's bus (before a campus change is tidied).
  seat("bus-bergen", "p-nils", "out"),
];

const ola = { $id: "p-ola", campus_id: "1", first_name: "Ola" };
const kari = { $id: "p-kari", campus_id: "1", first_name: "Kari" };
const nils = { $id: "p-nils", campus_id: "1", first_name: "Nils" };

function vars(
  participant: typeof ola,
  leg: "out" | "home",
  locale: "no" | "en"
) {
  return varsFor({ buses, leg, locale, members, participant, rooms });
}

describe("varsFor", () => {
  it("vars use the person's own bus and room", () => {
    expect(vars(ola, "out", "no")).toEqual({
      bus: "Buss 1",
      bus_contact: "Kari Nordmann, 912 34 567",
      departure: "fre. 24. jan. kl. 14:00",
      first_name: "Ola",
      meeting_point: "Nydalen T",
      room: "312",
      trip_home: "Hjem: Buss 2, søn. 26. jan. kl. 12:15.",
    });
    expect(vars(ola, "out", "en")).toMatchObject({
      departure: "Fri 24 Jan, 14:00",
      room: "312",
    });
    // The way home is on another bus, with its own details.
    expect(vars(ola, "home", "en")).toEqual({
      bus: "Buss 2",
      bus_contact: "Per Hansen",
      departure: "Sun 26 Jan, 12:15",
      first_name: "Ola",
      room: "312",
    });
    // A room without a number is named after its booker.
    expect(vars(kari, "home", "no")).toEqual({
      bus: "Buss 1",
      bus_contact: "Kari Nordmann, 912 34 567",
      departure: "søn. 26. jan. kl. 11:30",
      first_name: "Kari",
      meeting_point: "Hafjell hotell",
      room: "Rom · Kari Nordmann",
    });
    expect(vars(kari, "out", "en")).toEqual({
      bus: "Buss 2",
      bus_contact: "Per Hansen",
      first_name: "Kari",
      room: "Room · Kari Nordmann",
      trip_home: "Home: Buss 1, Sun 26 Jan, 11:30 from Hafjell hotell.",
    });
  });

  it("names the trip home on the way out only when it is another bus", () => {
    const home = (
      seats: ReturnType<typeof seat>[],
      locale: "no" | "en" = "no",
      leg: GroupLeg = "out"
    ) =>
      varsFor({ buses, leg, locale, members: seats, participant: ola, rooms })
        .trip_home;
    // Home on the same bus: nothing to add.
    expect(
      home([seat("bus-1", "p-ola", "out"), seat("bus-1", "p-ola", "home")])
    ).toBeUndefined();
    // Home on another bus: its name, time and meeting point, as far as known.
    expect(
      home([seat("bus-2", "p-ola", "out"), seat("bus-1", "p-ola", "home")])
    ).toBe("Hjem: Buss 1, søn. 26. jan. kl. 11:30 fra Hafjell hotell.");
    expect(
      home(
        [seat("bus-1", "p-ola", "out"), seat("bus-2", "p-ola", "home")],
        "en"
      )
    ).toBe("Home: Buss 2, Sun 26 Jan, 12:15.");
    // A seat out but none home yet.
    expect(home([seat("bus-1", "p-ola", "out")])).toBe(
      "Du har ikke plass på bussen hjem ennå."
    );
    expect(home([seat("bus-1", "p-ola", "out")], "en")).toBe(
      "You don't have a seat on the bus home yet."
    );
    // A home seat on another campus's bus doesn't count.
    expect(
      home([seat("bus-1", "p-ola", "out"), seat("bus-bergen", "p-ola", "home")])
    ).toBe("Du har ikke plass på bussen hjem ennå.");
    // No seat out: nothing. A message for the way home: nothing.
    expect(home([seat("bus-2", "p-ola", "home")])).toBeUndefined();
    expect(
      home(
        [seat("bus-1", "p-ola", "out"), seat("bus-2", "p-ola", "home")],
        "no",
        "home"
      )
    ).toBeUndefined();
  });

  it("never names another campus's bus", () => {
    expect(vars(nils, "out", "no")).toEqual({ first_name: "Nils" });
  });
});

// ── planDelivery / reachSummary ───────────────────────────────────────────────

function recipient(
  id: string,
  fields: {
    phone?: string | null;
    ticketEmail?: string | null;
    userEmail?: string | null;
    userId?: string | null;
    userLocale?: "no" | "en" | null;
  } = {}
): DeliveryRecipient {
  return {
    participant: {
      $id: id,
      phone: fields.phone ?? null,
      ticket_email: fields.ticketEmail ?? null,
      user_id: fields.userId ?? null,
    },
    userEmail: fields.userEmail ?? null,
    userLocale: fields.userLocale ?? null,
    vars: namedIn(id),
  };
}

/** Vars in both languages; only the first name, so both are the same. */
function namedIn(firstName: string) {
  return { en: { first_name: firstName }, no: { first_name: firstName } };
}

const people = [
  // Linked, has the app with push on.
  recipient("p-push", {
    ticketEmail: "ticket@example.com",
    userEmail: "account@example.com",
    userId: "u-push",
    userLocale: "no",
  }),
  // Linked, no push target: email to the ticket address first.
  recipient("p-linked-ticket", {
    ticketEmail: "kari@example.com",
    userEmail: "kari.account@example.com",
    userId: "u-quiet",
    userLocale: "en",
  }),
  // Linked, no push target, no ticket address: the account email.
  recipient("p-linked-account", {
    ticketEmail: "  ",
    userEmail: "per@example.com",
    userId: "u-quiet-2",
  }),
  // Not linked: the ticket address, both languages.
  recipient("p-unlinked", { ticketEmail: "nils@example.com" }),
];
const pushUsers = new Set(["u-push"]);

describe("planDelivery", () => {
  it("important goes both ways, others one way", () => {
    const normal = planDelivery({
      important: false,
      pushUsers,
      recipients: people,
      sms: false,
    });
    expect(normal).toEqual([
      {
        email: false,
        emailTo: null,
        locale: "no",
        participantId: "p-push",
        push: true,
        sms: false,
        smsTo: null,
        userId: "u-push",
        vars: namedIn("p-push"),
      },
      {
        email: true,
        emailTo: "kari@example.com",
        locale: "en",
        participantId: "p-linked-ticket",
        push: false,
        sms: false,
        smsTo: null,
        userId: "u-quiet",
        vars: namedIn("p-linked-ticket"),
      },
      {
        email: true,
        emailTo: "per@example.com",
        // A linked account without a language reads English (plan M6).
        locale: "en",
        participantId: "p-linked-account",
        push: false,
        sms: false,
        smsTo: null,
        userId: "u-quiet-2",
        vars: namedIn("p-linked-account"),
      },
      {
        email: true,
        emailTo: "nils@example.com",
        locale: null,
        participantId: "p-unlinked",
        push: false,
        sms: false,
        smsTo: null,
        userId: null,
        vars: namedIn("p-unlinked"),
      },
    ]);

    const important = planDelivery({
      important: true,
      pushUsers,
      recipients: people,
      sms: false,
    });
    expect(important[0]).toMatchObject({
      email: true,
      emailTo: "ticket@example.com",
      push: true,
    });
    expect(important.slice(1).map((p) => [p.push, p.email])).toEqual([
      [false, true],
      [false, true],
      [false, true],
    ]);
    expect(reachSummary(important)).toEqual({
      email: 4,
      people: 4,
      push: 1,
      sms: 0,
      unreachable: 0,
    });
  });

  it("nobody without an email or push is counted as unreachable", () => {
    const planned = planDelivery({
      important: false,
      pushUsers,
      recipients: [
        ...people,
        recipient("p-nothing"),
        recipient("p-linked-nothing", { userId: "u-quiet-3" }),
        // SMS isn't a way to reach anyone until an SMS provider exists.
        recipient("p-phone-only", { phone: "912 34 567" }),
        // The same person twice is planned once.
        recipient("p-unlinked", { ticketEmail: "nils@example.com" }),
      ],
      sms: true,
    });
    expect(planned.map((p) => p.participantId)).toEqual([
      "p-push",
      "p-linked-ticket",
      "p-linked-account",
      "p-unlinked",
      "p-nothing",
      "p-linked-nothing",
      "p-phone-only",
    ]);
    expect(planned.at(-1)).toMatchObject({
      email: false,
      push: false,
      sms: true,
      smsTo: "+4791234567",
    });
    expect(reachSummary(planned)).toEqual({
      email: 3,
      people: 7,
      push: 1,
      sms: 1,
      unreachable: 3,
    });
  });

  it("important with a push target and no email address is push only, and reached", () => {
    const planned = planDelivery({
      important: true,
      pushUsers,
      recipients: [recipient("p-app-only", { userId: "u-push" })],
      sms: false,
    });
    expect(planned).toEqual([
      {
        email: false,
        emailTo: null,
        locale: "en",
        participantId: "p-app-only",
        push: true,
        sms: false,
        smsTo: null,
        userId: "u-push",
        vars: namedIn("p-app-only"),
      },
    ]);
    expect(reachSummary(planned)).toEqual({
      email: 0,
      people: 1,
      push: 1,
      sms: 0,
      unreachable: 0,
    });
  });

  it("sends an SMS only when asked and a phone is known", () => {
    const withPhone = recipient("p-push-phone", {
      phone: "+47 912 34 567",
      userId: "u-push",
    });
    const [off] = planDelivery({
      important: false,
      pushUsers,
      recipients: [withPhone],
      sms: false,
    });
    expect(off).toMatchObject({ sms: false, smsTo: null });
    const [on] = planDelivery({
      important: false,
      pushUsers,
      recipients: [withPhone],
      sms: true,
    });
    expect(on).toMatchObject({ push: true, sms: true, smsTo: "+4791234567" });
  });
});

// ── Recipients ────────────────────────────────────────────────────────────────

describe("deliveryRecipients", () => {
  function person(
    participant: typeof ola,
    fields: { ticket_email?: string; user_id?: string }
  ) {
    return {
      ...participant,
      phone: null,
      ticket_email: null,
      user_id: null,
      ...fields,
    };
  }

  it("joins each person's account and their details in both languages", () => {
    const recipients = deliveryRecipients({
      accounts: [
        { $id: "u-ola", email: "ola@bi.no", locale: "no" },
        { $id: "u-kari", email: "kari@bi.no", locale: "de" },
      ],
      buses,
      leg: "home",
      members,
      people: [
        person(ola, { user_id: "u-ola" }),
        person(kari, { user_id: "u-kari" }),
        person(nils, { ticket_email: "nils@example.com", user_id: "u-gone" }),
      ],
      rooms,
    });

    expect(
      recipients.map((recipient) => [
        recipient.participant.$id,
        recipient.userEmail,
        recipient.userLocale,
      ])
    ).toEqual([
      ["p-ola", "ola@bi.no", "no"],
      // An account language other than no/en is unknown; a missing account too.
      ["p-kari", "kari@bi.no", null],
      ["p-nils", null, null],
    ]);
    expect(recipients[0]?.vars).toEqual({
      en: vars(ola, "home", "en"),
      no: vars(ola, "home", "no"),
    });
    expect(recipients[2]?.participant.ticket_email).toBe("nils@example.com");
  });
});

// ── Stored vars ───────────────────────────────────────────────────────────────

describe("stored vars", () => {
  it("read back as they were", () => {
    const vars = {
      en: { departure: "Fri 24 Jan, 14:00", first_name: "Ola" },
      no: { departure: "fre. 24. jan. kl. 14:00", first_name: "Ola" },
    };
    expect(parseStoredVars(serializeVars(vars))).toEqual(vars);
    expect(parseStoredVars(null)).toBeNull();
    expect(parseStoredVars("not json")).toBeNull();
    expect(parseStoredVars(JSON.stringify({ no: {} }))).toBeNull();
    expect(
      parseStoredVars(JSON.stringify({ en: {}, no: { bus: 3 } }))
    ).toBeNull();
  });

  it("long details are shortened to fit the column", () => {
    const longest = {
      bus: "b".repeat(200),
      bus_contact: "c".repeat(154),
      departure: "Fri 24 Jan, 14:00",
      first_name: "f".repeat(100),
      meeting_point: "m".repeat(300),
      room: "r".repeat(207),
    };
    const json = serializeVars({ en: longest, no: longest });
    expect(json.length).toBeLessThanOrEqual(1000);
    const back = parseStoredVars(json);
    // Short values stay whole; only the longest are cut, and say so.
    expect(back?.no.departure).toBe("Fri 24 Jan, 14:00");
    expect(back?.en.meeting_point?.endsWith("…")).toBe(true);
    expect(back?.en.meeting_point?.length).toBe(back?.en.bus?.length);
  });
});
