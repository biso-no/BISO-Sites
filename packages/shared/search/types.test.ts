import { describe, expect, it } from "vitest";
import {
  ALL_CAMPUSES,
  campusBucket,
  searchEntryId,
  toUnixSeconds,
} from "./types";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

describe("searchEntryId", () => {
  it("joins type, row id and locale", () => {
    expect(searchEntryId("event", "abc123", "no")).toBe("event_abc123_no");
  });

  it("only yields Meilisearch-safe characters", () => {
    expect(searchEntryId("page", "a.b", "en")).toMatch(SAFE_ID);
  });

  it("encodes injectively", () => {
    expect(searchEntryId("page", "a.b", "en")).not.toBe(
      searchEntryId("page", "a-b", "en")
    );
  });
});

describe("campusBucket", () => {
  it("keeps campus ids 1-4", () => {
    expect(campusBucket("2")).toBe("2");
  });

  it("maps national, empty and missing to all", () => {
    expect(campusBucket("5")).toBe(ALL_CAMPUSES);
    expect(campusBucket("")).toBe(ALL_CAMPUSES);
    expect(campusBucket(null)).toBe(ALL_CAMPUSES);
    expect(campusBucket(undefined)).toBe(ALL_CAMPUSES);
  });
});

describe("toUnixSeconds", () => {
  it("converts ISO strings", () => {
    expect(toUnixSeconds("2027-02-12T09:00:00.000Z")).toBe(1_802_422_800);
  });

  it("returns null for missing or invalid input", () => {
    expect(toUnixSeconds(null)).toBeNull();
    expect(toUnixSeconds("not a date")).toBeNull();
  });
});
