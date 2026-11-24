import { describe, expect, test } from "bun:test";
import {
  ALL_CAMPUSES,
  filterParticipants,
  NO_CAMPUS,
  type ParticipantFilters,
  type ParticipantListItem,
  uniqueEmails,
} from "./participant-list";

function item(overrides: Partial<ParticipantListItem>): ParticipantListItem {
  return {
    $collectionId: "big_event_participants",
    $createdAt: "",
    $databaseId: "app",
    $id: "p",
    $permissions: [],
    $sequence: 1,
    $tableId: "big_event_participants",
    $updatedAt: "",
    accountEmail: null,
    accountName: null,
    big_event_id: "b1",
    campus_id: "2",
    connect_reminded_at: null,
    connect_sent_at: null,
    dismissed_user_id: null,
    first_name: "Kari",
    last_import_id: null,
    last_name: "Nordmann",
    link_method: null,
    linked_at: null,
    membership_checked_at: null,
    membership_valid: null,
    phone: null,
    pile: "email",
    room_size: null,
    roomName: null,
    suggested_reason: null,
    suggested_user_id: null,
    ticket_category: null,
    ticket_email: null,
    ticket_ref: null,
    user_id: null,
    ...overrides,
  } as ParticipantListItem;
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
