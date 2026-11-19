import { describe, expect, it } from "vitest";
import en from "../../../../../packages/i18n/messages/en/expenses.json";
import no from "../../../../../packages/i18n/messages/no/expenses.json";

describe("receipt notices copy", () => {
  it("the amount notice tells a student how to attach a bank statement instead", () => {
    expect(en.composer.receiptNotices.amount_missing).toContain(
      "If this is a bank statement for another receipt, remove it and attach it to that receipt."
    );
    expect(no.composer.receiptNotices.amount_missing).toContain(
      "Er dette en kontoutskrift for en annen kvittering, fjern den og legg den ved den kvitteringen."
    );
  });
});
