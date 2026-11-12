import { describe, expect, test } from "bun:test";
import { microsoftIdentityEmails } from "./microsoft-identity";

describe("microsoftIdentityEmails", () => {
  test("ignores other providers and lowercases, trims and de-duplicates", () => {
    expect(
      microsoftIdentityEmails([
        { provider: "microsoft", providerEmail: " Finance.NU.Oslo@biso.no " },
        { provider: "microsoft", providerEmail: "finance.nu.oslo@biso.no" },
        { provider: "google", providerEmail: "other@gmail.com" },
        { provider: "microsoft", providerEmail: null },
        { provider: "microsoft" },
      ])
    ).toEqual(["finance.nu.oslo@biso.no"]);
  });
});
