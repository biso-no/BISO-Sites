import { AppwriteException } from "@repo/api";
import { describe, expect, it } from "vitest";
import { isRowNotFound } from "./units";

/**
 * The error shapes below were captured from the live Appwrite backend against
 * the guest client `createPublicClient()` builds, not invented:
 *
 *   getRow("app", "departments", "definitely-not-a-row")
 *     → code 404, type "row_not_found"
 *   getRow("app", "not_a_table", "1")
 *     → code 404, type "table_not_found"
 *
 * and the request wrapper in `@repo/api/server` converts an aborted call into
 * `AppwriteException(…, 504, "appwrite_timeout")`.
 *
 * Only the first may be reported as an absent unit. `cachedUnitDetail` turns
 * that into `null`, the route turns `null` into `notFound()`, and `"use cache"`
 * stores it — so a predicate that is too broad takes real units off the site
 * for the whole cache window every time the backend blinks.
 */
describe("isRowNotFound", () => {
  it("accepts the row-missing response", () => {
    expect(
      isRowNotFound(
        new AppwriteException("Row … could not be found", 404, "row_not_found")
      )
    ).toBe(true);
  });

  it("rejects a missing TABLE, which is a schema error, not an absent unit", () => {
    expect(
      isRowNotFound(
        new AppwriteException(
          "Table … could not be found",
          404,
          "table_not_found"
        )
      )
    ).toBe(false);
  });

  it("rejects a timeout", () => {
    expect(
      isRowNotFound(
        new AppwriteException(
          "Appwrite request timed out after 8000ms",
          504,
          "appwrite_timeout"
        )
      )
    ).toBe(false);
  });

  it("rejects other server-side failures", () => {
    expect(
      isRowNotFound(new AppwriteException("Server error", 500, "general_error"))
    ).toBe(false);
    expect(
      isRowNotFound(
        new AppwriteException("Unauthorized", 401, "general_unauthorized_scope")
      )
    ).toBe(false);
  });

  it("rejects anything that is not an AppwriteException, however it is shaped", () => {
    expect(isRowNotFound(new Error("boom"))).toBe(false);
    // A plain object that merely looks the part must not pass: only the real
    // SDK error carries a trustworthy `type`.
    expect(isRowNotFound({ code: 404, type: "row_not_found" })).toBe(false);
    expect(isRowNotFound(null)).toBe(false);
    expect(isRowNotFound(undefined)).toBe(false);
  });
});
