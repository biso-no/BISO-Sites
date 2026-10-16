import { describe, expect, it } from "bun:test";
import { buildTimestampOverrides, wpGmtToIso } from "./timestamps";

describe("wpGmtToIso", () => {
  it("treats a bare WordPress GMT string as UTC rather than host-local time", () => {
    expect(wpGmtToIso("2024-03-22T16:28:02")).toBe("2024-03-22T16:28:02.000Z");
  });

  it("keeps an explicit Z suffix", () => {
    expect(wpGmtToIso("2024-03-22T16:28:02Z")).toBe("2024-03-22T16:28:02.000Z");
  });

  it("honours an explicit UTC offset instead of appending Z", () => {
    expect(wpGmtToIso("2024-03-22T18:28:02+02:00")).toBe(
      "2024-03-22T16:28:02.000Z"
    );
  });

  it("preserves sub-second precision", () => {
    expect(wpGmtToIso("2024-03-22T16:28:02.500")).toBe(
      "2024-03-22T16:28:02.500Z"
    );
  });

  it("returns null for absent values so Appwrite stamps its own timestamp", () => {
    expect(wpGmtToIso(null)).toBeNull();
    expect(wpGmtToIso(undefined)).toBeNull();
    expect(wpGmtToIso("")).toBeNull();
    expect(wpGmtToIso("   ")).toBeNull();
  });

  it("returns null for WooCommerce's null-date placeholder", () => {
    expect(wpGmtToIso("0000-00-00T00:00:00")).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(wpGmtToIso("not a date")).toBeNull();
  });
});

describe("buildTimestampOverrides", () => {
  it("maps created and modified onto the Appwrite system columns", () => {
    expect(
      buildTimestampOverrides("2024-01-02T03:04:05", "2024-06-07T08:09:10")
    ).toEqual({
      $createdAt: "2024-01-02T03:04:05.000Z",
      $updatedAt: "2024-06-07T08:09:10.000Z",
    });
  });

  it("falls back to the created date when modified is missing", () => {
    expect(buildTimestampOverrides("2024-01-02T03:04:05", null)).toEqual({
      $createdAt: "2024-01-02T03:04:05.000Z",
      $updatedAt: "2024-01-02T03:04:05.000Z",
    });
  });

  it("omits both keys when the source has no usable date", () => {
    expect(buildTimestampOverrides(null, null)).toEqual({});
  });

  it("still backdates $updatedAt when only modified is known", () => {
    expect(buildTimestampOverrides(null, "2024-06-07T08:09:10")).toEqual({
      $updatedAt: "2024-06-07T08:09:10.000Z",
    });
  });
});
