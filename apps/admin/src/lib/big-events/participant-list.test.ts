import { describe, expect, test } from "bun:test";
import {
  ALL_CAMPUSES,
  connectEmailCount,
  filterParticipants,
  isConnectTarget,
  NO_CAMPUS,
  type ParticipantFilters,
  type ParticipantListItem,
  uniqueEmails,
} from "./participant-list";

function item(overrides: Partial<ParticipantListItem>): ParticipantListItem {
  return {
    $id: "p",
    accountEmail: null,
    accountName: null,
    campus_id: "2",
    connect_sent_at: null,
    first_name: "Kari",
    last_name: "Nordmann",
    membership_valid: null,
    phone: null,
    pile: "email",
    roomName: null,
    suggestion: null,
    ticket_email: null,
    user_id: null,
    ...overrides,
  };
}

const everyone: ParticipantFilters = {
  campus: ALL_CAMPUSES,
  noRoom: false,
  pile: "all",
  search: "",
};

const kari = item({
  $id: "p1",
  pile: "push",
  roomName: "Ola Hansen",
  ticket_email: "kari@example.com",
});
const ola = item({
  $id: "p2",
  campus_id: null,
  first_name: "Ola",
  last_name: "Hansen",
  ticket_email: "OLA@example.com",
});
const anne = item({
  $id: "p3",
  accountEmail: "s3@bi.no",
  campus_id: "1",
  first_name: "Anne",
  pile: "app_no_push",
  ticket_email: "ola@example.com",
});
const people = [kari, ola, anne];

const ids = (rows: ParticipantListItem[]) => rows.map((row) => row.$id);

describe("filterParticipants", () => {
  test("filters by pile, campus and room together", () => {
    expect(
      ids(filterParticipants(people, { ...everyone, pile: "push" }))
    ).toEqual(["p1"]);
    expect(
      ids(filterParticipants(people, { ...everyone, campus: NO_CAMPUS }))
    ).toEqual(["p2"]);
    expect(
      ids(filterParticipants(people, { ...everyone, campus: "1" }))
    ).toEqual(["p3"]);
    expect(
      ids(filterParticipants(people, { ...everyone, noRoom: true }))
    ).toEqual(["p2", "p3"]);
  });

  test("searches names and emails without caring about case", () => {
    expect(
      ids(filterParticipants(people, { ...everyone, search: "ola@EXAMPLE" }))
    ).toEqual(["p2", "p3"]);
    expect(
      ids(filterParticipants(people, { ...everyone, search: " kari nord" }))
    ).toEqual(["p1"]);
    expect(
      ids(filterParticipants(people, { ...everyone, search: "s3@bi" }))
    ).toEqual(["p3"]);
  });
});

describe("uniqueEmails", () => {
  test("prefers the account email and lists each address once", () => {
    expect(uniqueEmails(people)).toEqual([
      "kari@example.com",
      "OLA@example.com",
      "s3@bi.no",
    ]);
    expect(
      uniqueEmails([ola, item({ ticket_email: "ola@example.com" })])
    ).toEqual(["OLA@example.com"]);
  });
});

describe("connect send targets (R37)", () => {
  const fresh = item({ ticket_email: "a@x.no" });
  const emailed = item({
    connect_sent_at: "2026-12-03T09:00:00.000+00:00",
    ticket_email: "b@x.no",
  });
  const connected = item({ ticket_email: "c@x.no", user_id: "u1" });
  const noEmail = item({});

  test("new reaches only people never emailed; all reaches everyone not connected", () => {
    const rows = [fresh, emailed, connected, noEmail];
    expect(rows.filter((row) => isConnectTarget(row, "new"))).toEqual([fresh]);
    expect(rows.filter((row) => isConnectTarget(row, "all"))).toEqual([
      fresh,
      emailed,
    ]);
  });

  test("one email per address, whatever its casing", () => {
    expect(
      connectEmailCount([
        item({ ticket_email: "Family@x.no" }),
        item({ ticket_email: "family@x.no " }),
        item({ ticket_email: "ola@x.no" }),
        item({}),
      ])
    ).toBe(2);
  });
});
