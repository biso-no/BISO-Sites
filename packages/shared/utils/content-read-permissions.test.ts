import { describe, expect, it } from "vitest";
import {
  benefitReadPermissions,
  eventReadPermissions,
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
