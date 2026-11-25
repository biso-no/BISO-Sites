import { describe, expect, test } from "bun:test";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { roomBusRemovals } from "./plan-buses";
import {
  type ImportMapping,
  type ImportOptions,
  type ImportPlan,
  type PlacementTarget,
  parsePeople,
  planImport,
  sameIdentity,
} from "./plan-import";
import { existingGroupKey } from "./plan-import-rooms";
import { replacedMemberships, summarizePlan } from "./plan-summary";

const ROW_META = {
  $sequence: "1",
  $tableId: "t",
  $databaseId: "app",
  $createdAt: "2026-11-24T00:00:00.000Z",
  $updatedAt: "2026-11-24T00:00:00.000Z",
  $permissions: [] as string[],
};

function participant(
  id: string,
  fields: Partial<BigEventParticipantRow>
): BigEventParticipantRow {
  return {
    ...ROW_META,
    $id: id,
    big_event_id: "ev",
    bus_notice_due_at: null,
    bus_notified_at: null,
    campus_id: null,
    connect_nonce: null,
    connect_reminded_at: null,
    connect_sent_at: null,
    connect_token_hash: null,
    dismissed_user_id: null,
    first_name: "",
    last_import_id: null,
    last_name: null,
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
    room_size: null,
    suggested_reason: null,
    suggested_user_id: null,
    ticket_category: null,
    ticket_email: null,
    ticket_ref: null,
    user_id: null,
    ...fields,
  };
}

function group(
  id: string,
  fields: Partial<BigEventGroupRow>
): BigEventGroupRow {
  return {
    ...ROW_META,
    $id: id,
    big_event_id: "ev",
    booking_participant_id: null,
    campus_id: null,
    capacity: null,
    contact_name: null,
    contact_phone: null,
    contact_user_id: null,
    home_arrival_note: null,
    home_bus_id: null,
    home_departs_at: null,
    home_maps_url: null,
    home_meeting_point: null,
    kind: "room",
    name: "",
    note: null,
    out_bus_id: null,
    out_departs_at: null,
    out_maps_url: null,
    out_meeting_point: null,
    room_number: null,
    source_key: null,
    ...fields,
  };
}

function member(
  groupId: string,
  participantId: string,
  fields: Partial<BigEventGroupMemberRow> = {}
): BigEventGroupMemberRow {
  return {
    ...ROW_META,
    $id: `${groupId}-${participantId}${fields.leg ? `-${fields.leg}` : ""}`,
    assigned_at: null,
    big_event_id: "ev",
    group_id: groupId,
    leg: null,
    participant_id: participantId,
    pinned: null,
    ...fields,
  };
}

const NO_OPTIONS: ImportOptions = {
  defaultCampusId: null,
  groupKind: null,
  roomBookings: false,
};
const BOOKINGS: ImportOptions = { ...NO_OPTIONS, roomBookings: true };

/** Tickster's purchasers export: two title rows, header on row 3. */
const TICKSTER_HEADER_ROW = 2;
const TICKSTER_MAPPING: ImportMapping = {
  columns: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "ticket_ref",
    "ticket_category",
  ],
};
function tickster(...data: string[][]): string[][] {
  return [
    ["Kjøperliste"],
    ["Winter Games 2027"],
    ["Navn", "Etternavn", "E-post", "Mobilnr", "Ref.nr.", "Billettkategori"],
    ...data,
  ];
}

/** A Payment 2 / hosts' sheet: everyone, one full-name column, optional room column. */
const SHEET_MAPPING: ImportMapping = {
  columns: ["full_name", "email", "phone", "ticket_ref", "ignore"],
};
const SHEET_WITH_ROOM: ImportMapping = {
  columns: ["full_name", "email", "phone", "ticket_ref", "group"],
};
const SHEET_WITH_CAMPUS_AND_GROUP: ImportMapping = {
  columns: ["full_name", "email", "phone", "campus", "group"],
};
function sheet(...data: string[][]): string[][] {
  return [["Name", "Email", "Phone", "Order", "Room"], ...data];
}

interface Existing {
  groups?: BigEventGroupRow[];
  members?: BigEventGroupMemberRow[];
  participants?: BigEventParticipantRow[];
}

function plan(
  rows: string[][],
  headerRow: number,
  mapping: ImportMapping,
  options: ImportOptions,
  existing: Existing = {}
) {
  const parsed = parsePeople(rows, headerRow, mapping, options);
  return planImport({
    ...parsed,
    options,
    existing: existing.participants ?? [],
    groups: existing.groups ?? [],
    members: existing.members ?? [],
    travelEnabled: true,
    unseenGroupKinds: new Map(),
  });
}

/**
 * What saving a plan made from an empty list would write: participants,
 * groups and memberships, so the same file can be planned again.
 */
function asExisting(result: ImportPlan): Required<Existing> {
  const idOf = (target: PlacementTarget) =>
    "participantId" in target
      ? target.participantId
      : `p-row${target.rowNumber}`;
  return {
    participants: result.create.map((person) =>
      participant(`p-row${person.rowNumber}`, {
        first_name: person.firstName,
        last_name: person.lastName,
        ticket_email: person.email,
        phone: person.phone,
        campus_id: person.campusId,
        ticket_ref: person.ticketRef,
        ticket_category: person.ticketCategory,
        room_size: person.roomSize,
      })
    ),
    groups: result.newGroups.map((created) =>
      group(`g-${created.key}`, {
        kind: created.kind,
        name: created.name,
        campus_id: created.campusId,
        capacity: created.capacity,
        source_key: created.key,
        booking_participant_id: created.booker ? idOf(created.booker) : null,
      })
    ),
    members: result.placements.map((placement) =>
      member(`g-${placement.groupKey}`, idOf(placement.person))
    ),
  };
}

const OLA_ROW = [
  "Ola",
  "Nordmann",
  "ola@gmail.com",
  "91234567",
  "A-1",
  "1 x Bergen - BISO - 4-Person",
];

/** Ola bought room A-1 in Payment 1 and is its first member. */
const OLA = participant("p-ola", {
  first_name: "Ola",
  last_name: "Nordmann",
  ticket_email: "ola@gmail.com",
  phone: "+4791234567",
  ticket_ref: "A-1",
  campus_id: "2",
});
const OLA_ROOM = group("g-ola", {
  name: "Ola Nordmann",
  source_key: "booking:A-1",
  capacity: 4,
  booking_participant_id: "p-ola",
  campus_id: "2",
});
const WITH_OLA_ROOM: Existing = {
  participants: [OLA],
  groups: [OLA_ROOM],
  members: [member("g-ola", "p-ola")],
};

describe("parsePeople", () => {
  test("skips rows without a name", () => {
    const { people, skipped } = parsePeople(
      tickster(OLA_ROW, ["", "", "", "", "Totalt", "12"]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS
    );
    expect(people).toHaveLength(1);
    expect(skipped[0]?.reason).toBe("no_name");
    expect(skipped[0]?.rowNumber).toBe(5);
  });

  test("skips rows with neither email nor phone", () => {
    const { people, skipped } = parsePeople(
      tickster(["Kari", "Nordmann", "n/a", "", "A-2", ""]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS
    );
    expect(people).toEqual([]);
    expect(skipped).toEqual([{ rowNumber: 4, reason: "no_contact" }]);
  });

  test("reads campus and room size from the ticket category", () => {
    const { people } = parsePeople(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS
    );
    expect(people).toEqual([
      {
        rowNumber: 4,
        firstName: "Ola",
        lastName: "Nordmann",
        email: "ola@gmail.com",
        phone: "+4791234567",
        campusId: "2",
        ticketRef: "A-1",
        ticketCategory: "1 x Bergen - BISO - 4-Person",
        roomSize: 4,
        groupValue: null,
      },
    ]);
  });

  test("splits a full-name column and prefers a campus column", () => {
    const { people } = parsePeople(
      [
        ["Name", "Mobile", "Campus", "Ticket type"],
        ["Kari  Holm Nordmann", "92345678", "BI Oslo", "Bergen 2-Person"],
      ],
      0,
      { columns: ["full_name", "phone", "campus", "ticket_category"] },
      NO_OPTIONS
    );
    expect(people[0]?.firstName).toBe("Kari Holm");
    expect(people[0]?.lastName).toBe("Nordmann");
    expect(people[0]?.campusId).toBe("1");
  });
});

describe("sameIdentity", () => {
  const ola = {
    firstName: "Ola",
    lastName: "Nordmann",
    email: "ola@gmail.com",
    phone: "+4791234567",
    ticketRef: "A-1",
  };

  test("email alone never matches", () => {
    expect(
      sameIdentity(ola, {
        firstName: "Kari",
        lastName: "Nordmann",
        email: "ola@gmail.com",
        phone: null,
        ticketRef: null,
      })
    ).toBe(false);
  });

  test("same name with the same phone in another format matches", () => {
    expect(
      sameIdentity(ola, {
        firstName: "OLA",
        lastName: "nordmann",
        email: null,
        phone: "912 34 567",
        ticketRef: null,
      })
    ).toBe(true);
  });

  test("same ticket reference and name match", () => {
    expect(
      sameIdentity(ola, {
        firstName: "Ola",
        lastName: "Nordmann",
        email: "other@gmail.com",
        phone: null,
        ticketRef: "A-1",
      })
    ).toBe(true);
  });
});

describe("planImport: identities", () => {
  test("dedupes identical people within one file", () => {
    const result = plan(
      tickster(OLA_ROW, OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS
    );
    expect(result.create.length).toBe(1);
    expect(result.duplicatesInFile).toBe(1);
  });

  test("does not treat a shared email as one person", () => {
    const result = plan(
      tickster(OLA_ROW, [
        "Kari",
        "Nordmann",
        "ola@gmail.com",
        "92345678",
        "A-1",
        "",
      ]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS
    );
    expect(result.create.length).toBe(2);
    expect(result.duplicatesInFile).toBe(0);
  });

  test("matches an existing participant by name and phone after the email changed", () => {
    const result = plan(
      tickster(["Ola", "Nordmann", "ola.new@gmail.com", "912 34 567", "", ""]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS,
      { participants: [{ ...OLA, ticket_ref: null }] }
    );
    expect(result.update.length).toBe(1);
    expect(result.create).toEqual([]);
    expect(result.update[0]?.participantId).toBe("p-ola");
    expect(result.update[0]?.changes).toEqual({
      ticket_email: "ola.new@gmail.com",
    });
  });

  test("never clears an account link on update", () => {
    const linked = participant("p-ola", {
      ...OLA,
      $id: "p-ola",
      user_id: "user-1",
      linked_at: "2026-11-20T10:00:00.000Z",
      link_method: "email",
      ticket_category: null,
    });
    const result = plan(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS,
      { participants: [linked] }
    );
    const changes = result.update[0]?.changes ?? {};
    expect(changes.ticket_category).toBe("1 x Bergen - BISO - 4-Person");
    expect(Object.keys(changes)).not.toContain("user_id");
    expect(Object.keys(changes)).not.toContain("linked_at");
    expect(Object.keys(changes)).not.toContain("link_method");
  });

  test("lists existing participants missing from the file", () => {
    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Nordmann",
      phone: "+4792345678",
    });
    const result = plan(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS,
      { participants: [OLA, kari] }
    );
    expect(result.missingFromFile).toEqual(["p-kari"]);
  });

  test("a second row matching the same participant counts as a duplicate", () => {
    // Neither row matches the other (different email, one has no phone),
    // but both match Ola already on the list.
    const result = plan(
      tickster(
        ["Ola", "Nordmann", "ola@gmail.com", "", "", ""],
        ["Ola", "Nordmann", "ola.work@gmail.com", "91234567", "", ""]
      ),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS,
      { participants: [OLA] }
    );
    expect(result.update.length).toBe(1);
    expect(result.create).toEqual([]);
    expect(result.duplicatesInFile).toBe(1);
  });

  test("a default campus never replaces a known campus on update", () => {
    const result = plan(
      tickster(["Ola", "Nordmann", "ola@gmail.com", "91234567", "A-1", ""]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      { ...NO_OPTIONS, defaultCampusId: "1" },
      { participants: [OLA] }
    );
    expect(result.update[0]?.changes).toEqual({});
  });

  test("fixes name casing but never re-splits a name", () => {
    const lowercase = { ...OLA, first_name: "ola", last_name: "nordmann" };
    const casing = plan(
      tickster(["Ola", "Nordmann", "ola@gmail.com", "", "", ""]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      NO_OPTIONS,
      { participants: [lowercase] }
    );
    expect(casing.update[0]?.changes).toEqual({
      first_name: "Ola",
      last_name: "Nordmann",
    });

    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Holm Nordmann",
      phone: "+4792345678",
    });
    const split = plan(
      sheet(["KARI HOLM NORDMANN", "", "92345678", "", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      { participants: [kari] }
    );
    expect(split.update[0]?.changes).toEqual({});
  });
});

describe("planImport: campus", () => {
  test("uses the default campus when the file has none", () => {
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", ""]),
      0,
      SHEET_MAPPING,
      { ...NO_OPTIONS, defaultCampusId: "1" }
    );
    expect(result.create[0]?.campusId).toBe("1");
    expect(result.noCampus).toBe(0);
  });

  test("counts people with no campus", () => {
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", ""],
        ["Per Hansen", "", "93456789", "", ""]
      ),
      0,
      SHEET_MAPPING,
      NO_OPTIONS
    );
    expect(result.noCampus).toBe(2);
  });
});

describe("planImport: room bookings", () => {
  test("room bookings create one room per booking with open places", () => {
    const result = plan(
      tickster(OLA_ROW, [
        "Kari",
        "Nordmann",
        "kari@gmail.com",
        "92345678",
        "A-2",
        "1 x Oslo - BISO - 2-Person",
      ]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS
    );
    expect(result.newGroups).toHaveLength(2);
    expect(result.newGroups[0]).toEqual({
      key: "booking:A-1",
      kind: "room",
      name: "Ola Nordmann",
      campusId: "2",
      capacity: 4,
      bookingRowNumber: 4,
      booker: result.create[0],
    });
    expect(result.placements[0]).toEqual({
      person: result.create[0],
      groupKey: "booking:A-1",
      rule: "booking",
    });
    expect(result.overfullRooms).toEqual([]);
    expect(result.unplaced).toEqual([]);
  });

  test("a buyer with two bookings gets two rooms", () => {
    const result = plan(
      tickster(OLA_ROW, [
        "Ola",
        "Nordmann",
        "ola@gmail.com",
        "91234567",
        "A-2",
        "1 x Bergen - BISO - 2-Person",
      ]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS
    );
    const [ola] = result.create;
    // One person, two rooms.
    expect(result.create).toHaveLength(1);
    expect(result.duplicatesInFile).toBe(1);
    expect(ola?.ticketRef).toBe("A-1");
    expect(ola?.roomSize).toBe(4);
    expect(result.newGroups).toEqual([
      {
        key: "booking:A-1",
        kind: "room",
        name: "Ola Nordmann",
        campusId: "2",
        capacity: 4,
        bookingRowNumber: 4,
        booker: ola,
      },
      {
        key: "booking:A-2",
        kind: "room",
        name: "Ola Nordmann",
        campusId: "2",
        capacity: 2,
        bookingRowNumber: 5,
        booker: ola,
      },
    ]);
    // Ola fills one place in the first room; the second room is all open places.
    expect(result.placements).toEqual([
      { person: ola, groupKey: "booking:A-1", rule: "booking" },
    ]);
    expect(result.overfullRooms).toEqual([]);
  });

  test("re-import keeps both of a buyer's rooms", () => {
    const secondRoom = group("g-ola-2", {
      name: "Ola Nordmann",
      source_key: "booking:A-2",
      capacity: 2,
      booking_participant_id: "p-ola",
      campus_id: "2",
    });
    const existing = { ...WITH_OLA_ROOM, groups: [OLA_ROOM, secondRoom] };
    const secondRow = [
      "Ola",
      "Nordmann",
      "ola@gmail.com",
      "91234567",
      "A-2",
      "1 x Bergen - BISO - 2-Person",
    ];
    for (const rows of [
      tickster(OLA_ROW, secondRow),
      tickster(secondRow, OLA_ROW),
    ]) {
      const result = plan(
        rows,
        TICKSTER_HEADER_ROW,
        TICKSTER_MAPPING,
        BOOKINGS,
        existing
      );
      expect(result.newGroups).toEqual([]);
      // Ola stays in the room he is in, even when the rows come in another order.
      expect(result.placements).toEqual([]);
      expect(result.update).toHaveLength(1);
    }
  });

  test("a buyer's second booking without a reference gets its own room", () => {
    const rowRoom = group("g-row", {
      source_key: "booking:row4",
      capacity: 4,
      booking_participant_id: "p-ola",
    });
    const result = plan(
      tickster(
        ["Ola", "Nordmann", "ola@gmail.com", "", "", "Bergen 4-Person"],
        ["Ola", "Nordmann", "ola@gmail.com", "", "", "Bergen 2-Person"]
      ),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      {
        participants: [{ ...OLA, ticket_ref: null }],
        groups: [rowRoom],
        members: [member("g-row", "p-ola")],
      }
    );
    expect(result.newGroups).toHaveLength(1);
    expect(result.newGroups[0]?.key).toBe("booking:row5");
    expect(result.newGroups[0]?.capacity).toBe(2);
    expect(result.newGroups[0]?.booker).toEqual({ participantId: "p-ola" });
    expect(result.placements).toEqual([]);
  });

  test("reuses an existing room on re-import", () => {
    const result = plan(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      WITH_OLA_ROOM
    );
    expect(result.newGroups).toEqual([]);
    // Ola is already the room's member: nothing to place.
    expect(result.placements).toEqual([]);
    // Same size as before: nothing to update.
    expect(result.groupUpdates).toEqual([]);
  });

  test("a reused booking room takes the size on the ticket", () => {
    const result = plan(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      { ...WITH_OLA_ROOM, groups: [{ ...OLA_ROOM, capacity: 2 }] }
    );
    expect(result.newGroups).toEqual([]);
    expect(result.groupUpdates).toEqual([
      { groupKey: "booking:A-1", capacity: 4 },
    ]);
  });

  test("a booking row without a reference never takes someone else's room", () => {
    // Last time Ola was on row 4 of a file without references.
    const rowRoom = group("g-row", {
      source_key: "booking:row4",
      capacity: 4,
      booking_participant_id: "p-ola",
    });
    const kariFirst = tickster(
      ["Kari", "Nordmann", "kari@gmail.com", "", "", "Bergen 2-Person"],
      ["Ola", "Nordmann", "ola@gmail.com", "", "", "Bergen 4-Person"]
    );
    const result = plan(
      kariFirst,
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      {
        participants: [{ ...OLA, ticket_ref: null }],
        groups: [rowRoom],
        members: [member("g-row", "p-ola")],
      }
    );
    expect(result.newGroups).toHaveLength(1);
    expect(result.newGroups[0]?.key).not.toBe("booking:row4");
    expect(result.newGroups[0]?.name).toBe("Kari Nordmann");
    expect(result.placements).toEqual([
      {
        person: result.create[0],
        groupKey: result.newGroups[0]?.key,
        rule: "booking",
      },
    ]);
  });
});

describe("planImport: booked rooms", () => {
  test("re-import never moves a buyer the organizers moved", () => {
    // Ola booked A-1, but the organizers moved him into Kari's room.
    const kariRoom = group("g-kari", {
      source_key: "booking:K-1",
      capacity: 2,
    });
    const result = plan(
      tickster(OLA_ROW),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      {
        participants: [OLA],
        groups: [OLA_ROOM, kariRoom],
        members: [member("g-kari", "p-ola")],
      }
    );
    expect(result.newGroups).toEqual([]);
    expect(result.placements).toEqual([]);
  });

  test("two rooms on one row give two rooms", () => {
    const result = plan(
      tickster([
        "Ola",
        "Nordmann",
        "ola@gmail.com",
        "91234567",
        "A-1",
        "2 x Bergen - BISO - 4-Person",
      ]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS
    );
    const [ola] = result.create;
    const room = {
      kind: "room" as const,
      name: "Ola Nordmann",
      campusId: "2",
      capacity: 4,
      bookingRowNumber: 4,
      booker: ola,
    };
    expect(result.newGroups).toEqual([
      { ...room, key: "booking:A-1" },
      { ...room, key: "booking:A-1#2" },
    ]);
    // Ola takes one place; the second room is all open places.
    expect(result.placements).toEqual([
      { person: ola, groupKey: "booking:A-1", rule: "booking" },
    ]);
  });

  test("one order with two room types gives two rooms", () => {
    const result = plan(
      tickster(OLA_ROW, [
        "Ola",
        "Nordmann",
        "ola@gmail.com",
        "91234567",
        "A-1",
        "1 x Bergen - BISO - 2-Person",
      ]),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS
    );
    const [ola] = result.create;
    expect(result.create).toHaveLength(1);
    // Further rooms of an order are numbered by room type, so the keys do
    // not depend on the order of the rows.
    const rooms = Object.fromEntries(
      result.newGroups.map((room) => [
        room.key,
        [room.capacity, room.bookingRowNumber, room.booker],
      ])
    );
    expect(rooms).toEqual({
      "booking:A-1": [2, 5, ola],
      "booking:A-1#2": [4, 4, ola],
    });
    // Ola takes a place in the room on his first row.
    expect(result.placements).toEqual([
      { person: ola, groupKey: "booking:A-1#2", rule: "booking" },
    ]);
  });

  test("re-import reuses every room of a multi-room order", () => {
    const rows = [
      [
        "Ola",
        "Nordmann",
        "ola@gmail.com",
        "91234567",
        "A-1",
        "2 x Bergen - BISO - 4-Person",
      ],
      [
        "Ola",
        "Nordmann",
        "ola@gmail.com",
        "91234567",
        "A-1",
        "1 x Bergen - BISO - 2-Person",
      ],
      [
        "Kari",
        "Nordmann",
        "kari@gmail.com",
        "",
        "",
        "2 x Oslo - BISO - Dobbeltrom",
      ],
    ];
    const first = plan(
      tickster(...rows),
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS
    );
    expect(first.newGroups).toHaveLength(5);
    const saved = asExisting(first);
    for (const again of [rows, [...rows].reverse()]) {
      const result = plan(
        tickster(...again),
        TICKSTER_HEADER_ROW,
        TICKSTER_MAPPING,
        BOOKINGS,
        saved
      );
      expect(result.create).toEqual([]);
      expect(result.newGroups).toEqual([]);
      expect(result.placements).toEqual([]);
    }
  });

  test("planning the same Payment 1 file twice changes nothing", () => {
    const rows = tickster(
      OLA_ROW,
      [
        "Kari",
        "Nordmann",
        "ola@gmail.com",
        "92345678",
        "A-2",
        "2 x Oslo - BISO - 2-Person",
      ],
      [
        "Per",
        "Hansen",
        "per@gmail.com",
        "",
        "A-3",
        "1 x Trondheim - BISO - 3-Person",
      ],
      [
        "Per",
        "Hansen",
        "per@gmail.com",
        "",
        "A-3",
        "1 x Trondheim - BISO - Enkeltrom",
      ],
      ["Liv", "Berg", "", "93456789", "", "1 x Bergen - BISO - Dobbeltrom"],
      OLA_ROW,
      ["", "", "", "", "Totalt", "7"]
    );
    const first = plan(rows, TICKSTER_HEADER_ROW, TICKSTER_MAPPING, BOOKINGS);
    expect(first.create).toHaveLength(4);
    expect(first.newGroups.map((room) => room.key)).toEqual([
      "booking:A-1",
      "booking:A-2",
      "booking:A-2#2",
      "booking:A-3",
      "booking:A-3#2",
      "booking:row8",
    ]);
    expect(first.placements).toHaveLength(4);

    const again = plan(
      rows,
      TICKSTER_HEADER_ROW,
      TICKSTER_MAPPING,
      BOOKINGS,
      asExisting(first)
    );
    expect(again.create).toEqual([]);
    expect(again.update).toHaveLength(4);
    expect(again.update.every((u) => Object.keys(u.changes).length === 0)).toBe(
      true
    );
    expect(again.newGroups).toEqual([]);
    expect(again.placements).toEqual([]);
    expect(again.missingFromFile).toEqual([]);
  });
});

describe("planImport: placing into existing rooms", () => {
  test("places a Payment 2 traveller by order number", () => {
    // Payment 2 order B-7 covers Ola (already in his room) and Kari.
    const result = plan(
      sheet(
        ["Ola Nordmann", "ola@gmail.com", "91234567", "B-7", ""],
        ["Kari Nordmann", "kari@gmail.com", "92345678", "B-7", ""]
      ),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    const kari = result.create[0];
    expect(kari?.firstName).toBe("Kari");
    expect(result.placements).toEqual([
      { person: kari, groupKey: "booking:A-1", rule: "order_number" },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  test("places by an existing participant's order number", () => {
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "92345678", "A-1", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    expect(result.placements).toEqual([
      {
        person: result.create[0],
        groupKey: "booking:A-1",
        rule: "order_number",
      },
    ]);
  });

  test("places by the buyer's email", () => {
    const result = plan(
      sheet(["Kari Nordmann", "ola@gmail.com", "92345678", "C-3", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    expect(result.placements).toEqual([
      {
        person: result.create[0],
        groupKey: "booking:A-1",
        rule: "buyer_contact",
      },
    ]);
  });

  test("buyer contact with two rooms leaves the traveller unplaced", () => {
    const secondRoom = group("g-ola-2", {
      source_key: "booking:A-2",
      capacity: 2,
      booking_participant_id: "p-ola",
    });
    const result = plan(
      sheet(["Kari Nordmann", "ola@gmail.com", "92345678", "C-3", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      { ...WITH_OLA_ROOM, groups: [OLA_ROOM, secondRoom] }
    );
    // Ola booked two rooms: his email cannot say which one Kari is in.
    expect(result.placements).toEqual([]);
    expect(result.unplaced).toEqual(result.create);
    expect(result.unplaced).toHaveLength(1);
  });

  test("leaves unknown travellers unplaced", () => {
    const result = plan(
      sheet(["Per Hansen", "per@gmail.com", "93456789", "Z-9", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    expect(result.placements).toEqual([]);
    expect(result.unplaced).toEqual(result.create);
    expect(result.unplaced).toHaveLength(1);
  });

  test("does not guess when an order number points at two rooms", () => {
    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Nordmann",
      phone: "+4792345678",
      ticket_ref: "A-1",
    });
    const kariRoom = group("g-kari", {
      source_key: "booking:A-9",
      booking_participant_id: "p-kari",
    });
    const result = plan(
      sheet(["Per Hansen", "per@gmail.com", "93456789", "A-1", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      {
        participants: [OLA, kari],
        groups: [OLA_ROOM, kariRoom],
        members: [member("g-ola", "p-ola"), member("g-kari", "p-kari")],
      }
    );
    expect(result.placements).toEqual([]);
    expect(result.unplaced).toHaveLength(1);
  });

  test("an existing participant already in a room stays where they are", () => {
    const result = plan(
      sheet(["Ola Nordmann", "ola@gmail.com", "91234567", "", ""]),
      0,
      SHEET_MAPPING,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    expect(result.placements).toEqual([]);
    expect(result.unplaced).toEqual([]);
  });
});

describe("planImport: group column", () => {
  test("a mapped but empty group column still disables room bookings", () => {
    const withBus: ImportMapping = {
      columns: [...TICKSTER_MAPPING.columns, "group"],
    };
    const result = plan(
      tickster(
        [...OLA_ROW, ""],
        [
          "Ola",
          "Nordmann",
          "ola@gmail.com",
          "91234567",
          "A-2",
          "1 x Bergen - BISO - 2-Person",
          "",
        ]
      ),
      TICKSTER_HEADER_ROW,
      withBus,
      { ...BOOKINGS, groupKind: "bus" }
    );
    expect(result.newGroups).toEqual([]);
    expect(result.placements).toEqual([]);
    // A bus file says nothing about rooms.
    expect(result.unplaced).toEqual([]);
    expect(result.duplicatesInFile).toBe(1);
  });

  test("a room column holding a Payment 1 order number fills that booking's room", () => {
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "92345678", "B-7", "A-1"]),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      WITH_OLA_ROOM
    );
    expect(result.newGroups).toEqual([]);
    expect(result.placements).toEqual([
      {
        person: result.create[0],
        groupKey: "booking:A-1",
        rule: "group_column",
      },
    ]);
  });

  test("a group column without a kind is treated as rooms", () => {
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", "A-1"]),
      0,
      SHEET_WITH_ROOM,
      NO_OPTIONS,
      WITH_OLA_ROOM
    );
    expect(result.placements[0]?.groupKey).toBe("booking:A-1");
  });

  test("people with the same value share one new group", () => {
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", "Buss 1"],
        ["Per Hansen", "per@gmail.com", "", "", "buss  1"],
        ["Liv Berg", "liv@gmail.com", "", "", "Buss 2"]
      ),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "bus" }
    );
    expect(result.newGroups).toEqual([
      {
        key: "col:bus:-:buss 1",
        kind: "bus",
        name: "Buss 1",
        campusId: null,
        capacity: null,
        bookingRowNumber: null,
        booker: null,
      },
      {
        key: "col:bus:-:buss 2",
        kind: "bus",
        name: "Buss 2",
        campusId: null,
        capacity: null,
        bookingRowNumber: null,
        booker: null,
      },
    ]);
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:bus:-:buss 1",
      "col:bus:-:buss 1",
      "col:bus:-:buss 2",
    ]);
    expect(result.placements.every((p) => p.rule === "group_column")).toBe(
      true
    );
    // A bus file says nothing about rooms.
    expect(result.unplaced).toEqual([]);
  });

  test("one value across campuses makes one group per campus (R27)", () => {
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "Bergen", "Buss 1"],
        ["Per Hansen", "per@gmail.com", "", "Oslo", "Buss 1"],
        ["Ane Dahl", "ane@gmail.com", "", "Bergen", "buss  1"],
        ["Liv Berg", "liv@gmail.com", "", "", "Buss 1"]
      ),
      0,
      SHEET_WITH_CAMPUS_AND_GROUP,
      { ...NO_OPTIONS, groupKind: "bus" }
    );
    expect(
      result.newGroups.map((created) => [created.key, created.campusId])
    ).toEqual([
      ["col:bus:2:buss 1", "2"],
      ["col:bus:1:buss 1", "1"],
      ["col:bus:-:buss 1", null],
    ]);
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:bus:2:buss 1",
      "col:bus:1:buss 1",
      "col:bus:2:buss 1",
      "col:bus:-:buss 1",
    ]);
  });

  test("a value names only a group of the person's campus or one without a campus (R27)", () => {
    const osloBus = group("g-oslo", {
      campus_id: "1",
      kind: "bus",
      name: "Buss 1",
    });
    const sharedBus = group("g-shared", { kind: "bus", name: "Buss 9" });
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "Bergen", "Buss 1"],
        ["Per Hansen", "per@gmail.com", "", "Oslo", "Buss 1"],
        ["Ane Dahl", "ane@gmail.com", "", "Bergen", "Buss 9"]
      ),
      0,
      SHEET_WITH_CAMPUS_AND_GROUP,
      { ...NO_OPTIONS, groupKind: "bus" },
      { groups: [osloBus, sharedBus] }
    );
    expect(result.newGroups.map((created) => created.key)).toEqual([
      "col:bus:2:buss 1",
    ]);
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:bus:2:buss 1",
      "id:g-oslo",
      "id:g-shared",
    ]);
  });

  test("an existing column group is keyed with its own campus (R27)", () => {
    const bergen = group("g-b", {
      campus_id: "2",
      kind: "bus",
      source_key: "col:bus:-:buss 1",
    });
    const moved = group("g-m", {
      campus_id: "1",
      kind: "bus",
      source_key: "col:bus:2:buss 1",
    });
    const noCampus = group("g-n", {
      kind: "bus",
      source_key: "col:bus:-:buss 1",
    });
    expect(existingGroupKey(bergen)).toBe("col:bus:2:buss 1");
    expect(existingGroupKey(moved)).toBe("col:bus:1:buss 1");
    expect(existingGroupKey(noCampus)).toBe("col:bus:-:buss 1");
    // A value with a colon is never read as a campus (R34).
    const time = group("g-t", { kind: "room", source_key: "col:room:-:10:15" });
    expect(existingGroupKey(time)).toBe("col:room:-:10:15");
    expect(existingGroupKey({ ...time, campus_id: "2" })).toBe(
      "col:room:2:10:15"
    );
    expect(existingGroupKey(OLA_ROOM)).toBe("booking:A-1");
    expect(existingGroupKey(group("g-x", {}))).toBe("id:g-x");
  });

  test("everyone already on the list gets their column target, even when already there (R34)", () => {
    const room101 = group("g-101", {
      name: "101",
      source_key: "col:room:-:101",
    });
    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Nordmann",
      ticket_email: "kari@gmail.com",
    });
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", "101"],
        ["Per Hansen", "per@gmail.com", "", "", "102"]
      ),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      {
        groups: [room101],
        members: [member("g-101", "p-kari")],
        participants: [kari],
      }
    );
    // Kari is in room 101 already: no new place, but 101 is still her target.
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:room:-:102",
    ]);
    expect(result.columnTargets).toEqual([
      { groupKey: "col:room:-:101", participantId: "p-kari" },
    ]);
  });

  test("a column value can name an existing group of the same kind only", () => {
    const handMadeRoom = group("g-101", { name: "Rom 101" });
    const bus = group("g-bus", { kind: "bus", name: "Rom 101" });
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", "rom 101"]),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      { groups: [bus, handMadeRoom] }
    );
    expect(result.newGroups).toEqual([]);
    expect(result.placements[0]?.groupKey).toBe("id:g-101");
  });

  test("an empty room cell falls back to the order number", () => {
    const result = plan(
      sheet(
        ["Per Hansen", "per@gmail.com", "", "Z-9", "Rom 9"],
        ["Kari Nordmann", "kari@gmail.com", "", "A-1", ""]
      ),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      WITH_OLA_ROOM
    );
    const [per, kari] = result.create;
    expect(result.placements).toEqual([
      { person: per, groupKey: "col:room:-:rom 9", rule: "group_column" },
      { person: kari, groupKey: "booking:A-1", rule: "order_number" },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  test("flags a room with more people than places", () => {
    const smallRoom = { ...OLA_ROOM, capacity: 2 };
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", "A-1"],
        ["Per Hansen", "per@gmail.com", "", "", "A-1"]
      ),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      { ...WITH_OLA_ROOM, groups: [smallRoom] }
    );
    expect(result.placements).toHaveLength(2);
    expect(result.overfullRooms).toEqual(["booking:A-1"]);
  });
});

describe("replacedMemberships", () => {
  test("a place in a group with the target's key is never replaced", () => {
    // Two rooms share one key (made by hand, or left by an old import). Kari
    // is only in the second one, which the plan reads as already there.
    const room101 = group("g-101", {
      name: "101",
      source_key: "col:room:-:101",
    });
    const twin101 = group("g-101-twin", {
      name: "101",
      source_key: "col:room:-:101",
    });
    const room102 = group("g-102", {
      name: "102",
      source_key: "col:room:-:102",
    });
    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Nordmann",
      ticket_email: "kari@gmail.com",
    });
    const existing = {
      groups: [room101, twin101, room102],
      members: [member("g-101-twin", "p-kari"), member("g-102", "p-kari")],
      participants: [kari],
    };
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", "101"]),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      existing
    );

    expect(result.placements).toEqual([]);
    expect(
      replacedMemberships(result, existing.groups, existing.members).map(
        (membership) => membership.group_id
      )
    ).toEqual(["g-102"]);
  });
});

describe("planImport: pins (R31)", () => {
  const room101 = group("g-101", {
    name: "101",
    source_key: "col:room:-:101",
  });
  const kari = participant("p-kari", {
    first_name: "Kari",
    last_name: "Nordmann",
    ticket_email: "kari@gmail.com",
  });

  test("import never moves a pinned person", () => {
    // The organizers moved Kari into room 101 by hand; the file says 103.
    const existing = {
      groups: [room101],
      members: [member("g-101", "p-kari", { pinned: true })],
      participants: [kari],
    };
    const options = { ...NO_OPTIONS, groupKind: "room" as const };
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", "103"]),
      0,
      SHEET_WITH_ROOM,
      options,
      existing
    );

    // No new room 103 for her, no new place, nothing to replace.
    expect(result.newGroups).toEqual([]);
    expect(result.placements).toEqual([]);
    expect(result.columnTargets).toEqual([]);
    expect(result.keptPinned).toEqual(["p-kari"]);
    expect(
      replacedMemberships(result, existing.groups, existing.members)
    ).toEqual([]);
    // A target elsewhere never takes a pinned place either.
    const room102 = group("g-102", {
      name: "102",
      source_key: "col:room:-:102",
    });
    const groups = [room101, room102];
    expect(
      replacedMemberships(
        {
          ...result,
          columnTargets: [
            { groupKey: "col:room:-:102", participantId: "p-kari" },
          ],
        },
        groups,
        existing.members
      )
    ).toEqual([]);

    const preview = summarizePlan(result, {
      busListsPublished: false,
      existing: existing.participants,
      groupColumn: true,
      groups: existing.groups,
      members: existing.members,
      options,
      outsideYourCampus: 0,
    });
    expect(preview).toMatchObject({ keptPinned: 1, moved: 0, placed: 0 });
  });

  test("a bus leg moved by hand keeps the person on their buses", () => {
    const bus = (id: string, name: string) =>
      group(id, {
        kind: "bus",
        name,
        source_key: `col:bus:-:${name.toLowerCase()}`,
      });
    const existing = {
      groups: [bus("g-b1", "Buss 1"), bus("g-b2", "Buss 2")],
      members: [
        member("g-b1", "p-kari", { leg: "out", pinned: true }),
        member("g-b1", "p-kari", { leg: "home" }),
      ],
      participants: [kari],
    };
    const result = plan(
      sheet(["Kari Nordmann", "kari@gmail.com", "", "", "Buss 2"]),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "bus" },
      existing
    );
    expect(result.placements).toEqual([]);
    expect(result.keptPinned).toEqual(["p-kari"]);
    expect(
      replacedMemberships(result, existing.groups, existing.members)
    ).toEqual([]);
  });
});

describe("planImport: overfull rooms", () => {
  test("overfull counts leave out people who move out", () => {
    // Room 101 holds two and is full: Kari moves to 102, Per takes her place.
    const room101 = group("g-101", {
      name: "101",
      source_key: "col:room:-:101",
      capacity: 2,
    });
    const kari = participant("p-kari", {
      first_name: "Kari",
      last_name: "Nordmann",
      ticket_email: "kari@gmail.com",
    });
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", "102"],
        ["Per Hansen", "per@gmail.com", "", "", "101"]
      ),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "room" },
      {
        groups: [room101],
        members: [member("g-101", "p-kari"), member("g-101", "p-ola")],
        participants: [kari],
      }
    );
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:room:-:102",
      "col:room:-:101",
    ]);
    expect(result.overfullRooms).toEqual([]);
  });
});

describe("planImport: room buses (N2)", () => {
  const bus1 = group("g-b1", { kind: "bus", name: "Buss 1" });
  const bus2 = group("g-b2", { kind: "bus", name: "Buss 2" });
  const room101 = group("g-101", {
    name: "101",
    source_key: "col:room:-:101",
    out_bus_id: "g-b1",
    home_bus_id: "g-b1",
  });
  const kari = participant("p-kari", {
    first_name: "Kari",
    last_name: "Nordmann",
    ticket_email: "kari@gmail.com",
  });
  const file = () =>
    sheet(
      ["Kari Nordmann", "kari@gmail.com", "", "", "101"],
      ["Per Hansen", "per@gmail.com", "", "", "101"]
    );
  const roomImport = { ...NO_OPTIONS, groupKind: "room" as const };

  test("people in a room ride its bus, except on a leg moved by hand", () => {
    const result = plan(file(), 0, SHEET_WITH_ROOM, roomImport, {
      groups: [bus1, bus2, room101],
      members: [member("g-b2", "p-kari", { leg: "out", pinned: true })],
      participants: [kari],
    });
    const per = result.create[0];
    expect(result.roomBuses).toEqual([
      // Kari's way home follows her hand-moved way out (ruling R5).
      { busId: "g-b2", leg: "home", person: { participantId: "p-kari" } },
      { busId: "g-b1", leg: "out", person: per },
      { busId: "g-b1", leg: "home", person: per },
    ]);
  });

  test("a way home moved by hand stays, with or without a pinned way out", () => {
    const bus3 = group("g-b3", { kind: "bus", name: "Buss 3" });
    const ola = participant("p-ola", {
      first_name: "Ola",
      last_name: "Hansen",
      ticket_email: "ola@gmail.com",
    });
    const existing = {
      groups: [bus1, bus2, bus3, room101],
      members: [
        // Kari's way home was moved to bus 2 by hand, her way out wasn't.
        member("g-b2", "p-kari", { leg: "home", pinned: true }),
        // Ola was moved out to bus 2 and home to bus 3, both by hand.
        member("g-b2", "p-ola", { leg: "out", pinned: true }),
        member("g-b3", "p-ola", { leg: "home", pinned: true }),
      ],
      participants: [kari, ola],
    };
    const result = plan(
      sheet(
        ["Kari Nordmann", "kari@gmail.com", "", "", "101"],
        ["Ola Hansen", "ola@gmail.com", "", "", "101"]
      ),
      0,
      SHEET_WITH_ROOM,
      roomImport,
      existing
    );
    expect(result.roomBuses).toEqual([
      { busId: "g-b1", leg: "out", person: { participantId: "p-kari" } },
    ]);
    expect(roomBusRemovals(result, existing.groups, existing.members)).toEqual(
      []
    );
  });

  test("a room with only a bus out takes people home on it too", () => {
    const outOnly = { ...room101, home_bus_id: null };
    const result = plan(file(), 0, SHEET_WITH_ROOM, roomImport, {
      groups: [bus1, bus2, outOnly],
      // Kari's way home was moved to bus 2 by hand: it stays.
      members: [member("g-b2", "p-kari", { leg: "home", pinned: true })],
      participants: [kari],
    });
    const per = result.create[0];
    expect(result.roomBuses).toEqual([
      { busId: "g-b1", leg: "out", person: { participantId: "p-kari" } },
      { busId: "g-b1", leg: "out", person: per },
      { busId: "g-b1", leg: "home", person: per },
    ]);
  });

  test("no room buses without Travel or in a bus or group import", () => {
    const existing = {
      groups: [bus1, room101],
      members: [member("g-101", "p-kari")],
      participants: [kari],
    };
    const parsed = parsePeople(file(), 0, SHEET_WITH_ROOM, roomImport);
    const noTravel = planImport({
      ...parsed,
      options: roomImport,
      existing: existing.participants,
      groups: existing.groups,
      members: existing.members,
      travelEnabled: false,
      unseenGroupKinds: new Map(),
    });
    expect(noTravel.roomBuses).toEqual([]);
    const buddies = plan(
      file(),
      0,
      SHEET_WITH_ROOM,
      { ...NO_OPTIONS, groupKind: "buddy" },
      existing
    );
    expect(buddies.roomBuses).toEqual([]);
  });
});
