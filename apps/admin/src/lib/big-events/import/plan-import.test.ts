import { describe, expect, test } from "bun:test";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import {
  type ImportMapping,
  type ImportOptions,
  parsePeople,
  planImport,
  sameIdentity,
} from "./plan-import";

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
    kind: "room",
    name: "",
    note: null,
    room_number: null,
    source_key: null,
    ...fields,
  };
}

function member(
  groupId: string,
  participantId: string
): BigEventGroupMemberRow {
  return {
    ...ROW_META,
    $id: `${groupId}-${participantId}`,
    assigned_at: null,
    big_event_id: "ev",
    group_id: groupId,
    leg: null,
    participant_id: participantId,
    pinned: null,
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
  });
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
    });
    expect(result.placements[0]).toEqual({
      person: result.create[0],
      groupKey: "booking:A-1",
      rule: "booking",
    });
    expect(result.overfullRooms).toEqual([]);
    expect(result.unplaced).toEqual([]);
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
        key: "col:bus:buss 1",
        kind: "bus",
        name: "Buss 1",
        campusId: null,
        capacity: null,
        bookingRowNumber: null,
      },
      {
        key: "col:bus:buss 2",
        kind: "bus",
        name: "Buss 2",
        campusId: null,
        capacity: null,
        bookingRowNumber: null,
      },
    ]);
    expect(result.placements.map((placement) => placement.groupKey)).toEqual([
      "col:bus:buss 1",
      "col:bus:buss 1",
      "col:bus:buss 2",
    ]);
    expect(result.placements.every((p) => p.rule === "group_column")).toBe(
      true
    );
    // A bus file says nothing about rooms.
    expect(result.unplaced).toEqual([]);
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
      { person: per, groupKey: "col:room:rom 9", rule: "group_column" },
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
