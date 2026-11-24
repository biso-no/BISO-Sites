import { describe, expect, test } from "bun:test";
import {
  formatBigEventDates,
  formatOsloShortDay,
  joinOsloDateTime,
  splitOsloDateTime,
} from "./dates";

describe("Oslo date and time inputs", () => {
  test("a winter date and time is one hour ahead of UTC", () => {
    expect(joinOsloDateTime("2027-01-24", "08:00")).toBe(
      "2027-01-24T07:00:00.000Z"
    );
  });

  test("a summer date and time is two hours ahead of UTC", () => {
    expect(joinOsloDateTime("2027-08-14", "18:30")).toBe(
      "2027-08-14T16:30:00.000Z"
    );
  });

  test("missing parts give an empty value", () => {
    expect(joinOsloDateTime("", "08:00")).toBe("");
    expect(joinOsloDateTime("2027-01-24", "")).toBe("");
  });

  test("a stored instant splits back into the Oslo date and time", () => {
    expect(splitOsloDateTime("2027-01-23T23:30:00.000+00:00")).toEqual({
      date: "2027-01-24",
      time: "00:30",
    });
    expect(splitOsloDateTime(null)).toEqual({ date: "", time: "" });
  });
});

describe("formatBigEventDates", () => {
  test("shows both days in Norwegian", () => {
    expect(
      formatBigEventDates(
        "2027-01-24T07:00:00.000Z",
        "2027-01-27T17:00:00.000Z",
        "no"
      )
    ).toBe("24. jan. 2027 – 27. jan. 2027");
  });

  test("shows one day when it starts and ends the same Oslo day", () => {
    expect(
      formatBigEventDates(
        "2027-08-14T08:00:00.000Z",
        "2027-08-14T21:30:00.000Z",
        "en"
      )
    ).toBe("14. Aug 2027");
  });

  test("uses the Oslo day, not the UTC day", () => {
    expect(
      formatBigEventDates(
        "2027-01-23T23:30:00.000Z",
        "2027-01-23T23:45:00.000Z",
        "en"
      )
    ).toBe("24. Jan 2027");
  });
});

describe("formatOsloShortDay", () => {
  test("shows day and month in each language, on the Oslo day", () => {
    expect(formatOsloShortDay("2026-12-02T23:30:00.000Z", "en")).toBe("3 Dec");
    expect(formatOsloShortDay("2026-12-03T09:00:00.000+00:00", "no")).toBe(
      "3. des."
    );
    expect(formatOsloShortDay("not a date", "en")).toBe("");
  });
});
