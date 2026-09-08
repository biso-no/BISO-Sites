import { describe, expect, mock, test } from "bun:test";
import {
  getAllowedTenantUser,
  isAllowedTenantUser,
  isWithinCampusScope,
} from "./tenant-guard";

const ANOTHER_CAMPUS_ERROR = /another campus/i;
const UNLICENSED_ERROR = /licensed @biso\.no/i;

const licensedOsloUser = {
  assignedLicenses: [{ skuId: "sku-1" }],
  displayName: "Ada Lovelace",
  id: "user-1",
  officeLocation: "Oslo",
  userPrincipalName: "ada.lovelace@biso.no",
};

describe("isAllowedTenantUser", () => {
  test("accepts a licensed @biso.no account", () => {
    expect(isAllowedTenantUser(licensedOsloUser)).toBe(true);
  });

  test("rejects an unlicensed account", () => {
    expect(
      isAllowedTenantUser({ ...licensedOsloUser, assignedLicenses: [] })
    ).toBe(false);
  });

  test("rejects a guest from another domain", () => {
    expect(
      isAllowedTenantUser({
        ...licensedOsloUser,
        userPrincipalName: "guest@example.com",
      })
    ).toBe(false);
  });
});

describe("isWithinCampusScope", () => {
  test("a null scope is unrestricted (global admin)", () => {
    expect(isWithinCampusScope({ officeLocation: "Bergen" }, null)).toBe(true);
    expect(isWithinCampusScope({}, null)).toBe(true);
  });

  test("matches officeLocation against the managed campuses", () => {
    expect(isWithinCampusScope({ officeLocation: "Oslo" }, ["Oslo"])).toBe(
      true
    );
    expect(isWithinCampusScope({ officeLocation: "Bergen" }, ["Oslo"])).toBe(
      false
    );
  });

  test("matches case- and whitespace-insensitively", () => {
    expect(isWithinCampusScope({ officeLocation: " oslo " }, ["Oslo"])).toBe(
      true
    );
  });

  test("fails closed for an account with no officeLocation", () => {
    expect(isWithinCampusScope({}, ["Oslo"])).toBe(false);
    expect(isWithinCampusScope({ officeLocation: "  " }, ["Oslo"])).toBe(false);
  });

  test("an empty scope matches nothing", () => {
    expect(isWithinCampusScope({ officeLocation: "Oslo" }, [])).toBe(false);
  });
});

describe("getAllowedTenantUser", () => {
  function graphReturning(user: unknown) {
    return { getUser: mock(() => Promise.resolve(user)) } as never;
  }

  test("returns the user when it is inside the caller's campus scope", async () => {
    const user = await getAllowedTenantUser(
      graphReturning(licensedOsloUser),
      "user-1",
      ["Oslo"]
    );
    expect(user.id).toBe("user-1");
  });

  test("refuses a user from a campus the caller does not manage", async () => {
    await expect(
      getAllowedTenantUser(
        graphReturning({ ...licensedOsloUser, officeLocation: "Bergen" }),
        "user-1",
        ["Oslo"]
      )
    ).rejects.toThrow(ANOTHER_CAMPUS_ERROR);
  });

  test("a global admin (null scope) reaches any campus", async () => {
    const user = await getAllowedTenantUser(
      graphReturning({ ...licensedOsloUser, officeLocation: "Trondheim" }),
      "user-1",
      null
    );
    expect(user.officeLocation).toBe("Trondheim");
  });

  test("still rejects an unlicensed account before the campus check", async () => {
    await expect(
      getAllowedTenantUser(
        graphReturning({ ...licensedOsloUser, assignedLicenses: [] }),
        "user-1",
        ["Oslo"]
      )
    ).rejects.toThrow(UNLICENSED_ERROR);
  });
});
