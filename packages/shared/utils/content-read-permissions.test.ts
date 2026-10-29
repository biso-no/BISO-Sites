import { describe, expect, it } from "vitest";
import {
  benefitReadPermissions,
  eventReadPermissions,
  translationReadPermissions,
} from "./content-read-permissions";

const PUBLIC_READ = ['read("any")'];

describe("eventReadPermissions", () => {
  it("is world-readable when published or cancelled", () => {
    expect(eventReadPermissions("published")).toEqual(PUBLIC_READ);
    expect(eventReadPermissions("cancelled")).toEqual(PUBLIC_READ);
  });

  it("grants no read for any other status", () => {
    expect(eventReadPermissions("draft")).toEqual([]);
    expect(eventReadPermissions("")).toEqual([]);
    expect(eventReadPermissions("archived")).toEqual([]);
  });
});

describe("benefitReadPermissions", () => {
  it("is world-readable only when published", () => {
    expect(benefitReadPermissions("published")).toEqual(PUBLIC_READ);
    expect(benefitReadPermissions("draft")).toEqual([]);
    expect(benefitReadPermissions("archived")).toEqual([]);
  });
});

const STAFF_READS = [
  'read("team:sg-app-dept-operationsunit")',
  'read("team:sg-app-dept-hr")',
];

describe("translationReadPermissions", () => {
  it("follows the event rule", () => {
    expect(translationReadPermissions("event", "published")).toEqual(
      PUBLIC_READ
    );
    expect(translationReadPermissions("event", "cancelled")).toEqual(
      PUBLIC_READ
    );
    expect(translationReadPermissions("event", "draft")).toEqual([]);
  });

  it("follows the benefit rule", () => {
    expect(translationReadPermissions("memberBenefit", "published")).toEqual(
      PUBLIC_READ
    );
    expect(translationReadPermissions("memberBenefit", "draft")).toEqual([]);
  });

  it("is public for published news and products only", () => {
    for (const type of ["news", "product"] as const) {
      expect(translationReadPermissions(type, "published")).toEqual(
        PUBLIC_READ
      );
      expect(translationReadPermissions(type, "draft")).toEqual([]);
      expect(translationReadPermissions(type, null)).toEqual([]);
    }
  });

  it("adds the recruitment staff reads for jobs in every status", () => {
    expect(translationReadPermissions("job", "published")).toEqual([
      ...PUBLIC_READ,
      ...STAFF_READS,
    ]);
    expect(translationReadPermissions("job", "draft")).toEqual(STAFF_READS);
  });

  it("is always public for departments", () => {
    expect(translationReadPermissions("department", null)).toEqual(PUBLIC_READ);
    expect(translationReadPermissions("department", "draft")).toEqual(
      PUBLIC_READ
    );
  });
});
