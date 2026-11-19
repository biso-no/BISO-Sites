import { describe, expect, test } from "bun:test";
import { loadMessages } from "@repo/i18n/messages";

interface ExpenseMessages {
  changeApprover: Record<string, string>;
  decision: Record<string, string>;
  errors: Record<string, string>;
  onBehalfRoles: Record<string, string>;
  retry: Record<string, string>;
  steps: Record<string, string>;
}

async function expenseMessages(locale: "en" | "no"): Promise<ExpenseMessages> {
  const messages = (await loadMessages(locale)) as unknown as {
    adminPortal: { expenses: ExpenseMessages };
  };
  return messages.adminPortal.expenses;
}

const DOUBLE_ARTICLE = /\bthe the\b/i;
const PLACEHOLDER = /\{(\w+)\}/g;

const render = (template: string, values: Record<string, string>): string =>
  template.replace(PLACEHOLDER, (_, key: string) => values[key] ?? "");

const en = await expenseMessages("en");
const no = await expenseMessages("no");

describe("on-behalf labels", () => {
  test("read cleanly in English, with the article only in the role noun", () => {
    const role = en.onBehalfRoles.finance as string;
    expect(render(en.decision.approveOnBehalf as string, { role })).toBe(
      "Approve on behalf of the financial manager"
    );
    expect(render(en.steps.onBehalf as string, { name: "Ada", role })).toBe(
      "Ada on behalf of the financial manager"
    );
  });

  test("read cleanly in Norwegian", () => {
    const role = no.onBehalfRoles.finance as string;
    expect(render(no.decision.approveOnBehalf as string, { role })).toBe(
      "Godkjenn på vegne av økonomiansvarlig"
    );
  });

  test("never double the article in any role", () => {
    for (const template of [
      en.decision.approveOnBehalf,
      en.decision.rejectOnBehalf,
      en.decision.onBehalfHint,
      en.steps.onBehalf,
    ]) {
      for (const role of Object.values(en.onBehalfRoles)) {
        expect(render(template as string, { name: "x", role })).not.toMatch(
          DOUBLE_ARTICLE
        );
      }
    }
  });
});

describe("approver and retry warnings", () => {
  test("the directory warning stands on its own", () => {
    expect(en.changeApprover.directoryNotSaved).toBe(
      "The saved approver for future expenses could not be updated."
    );
    expect(no.changeApprover.directoryNotSaved).toBe(
      "Den lagrede godkjenneren for fremtidige utlegg kunne ikke oppdateres."
    );
  });

  test("the failed-again message does not point at text that is not on screen", () => {
    expect(en.retry.failedAgain).toBe("The booking failed again.");
    expect(no.retry.failedAgain).toBe("Bokføringen mislyktes igjen.");
  });

  test("an unanswered retry tells the person to check Finago first", () => {
    expect(en.retry.apiFailed).toBe(
      "The booking service did not answer. Check in Finago whether the expense was booked before you retry."
    );
    expect(no.retry.apiFailed).toContain("Finago");
  });
});

describe("a booking Finago has but the admin could not save", () => {
  test("a failed status save never invites booking it again", () => {
    expect(en.errors.status_write_failed).toBe(
      "Finago has the booking, but saving the status failed. Don't book it again: once the reimbursement shows Booking failed (within about 15 minutes), Retry finishes saving it."
    );
    for (const message of [
      en.errors.status_write_failed,
      no.errors.status_write_failed,
    ]) {
      expect(message).not.toContain("nothing is booked twice");
      expect(message).not.toContain("ingenting bokføres to ganger");
    }
    expect(no.errors.status_write_failed).toContain("Bokføring feilet");
  });

  test("an unrecorded booking names the transaction and says not to retry", () => {
    expect(
      render(en.errors.booking_unrecorded as string, { transactionId: "tx-9" })
    ).toBe(
      "Finago has the booking (tx-9) but it could not be saved here. Do not retry; contact IT."
    );
    expect(
      render(no.errors.booking_unrecorded as string, { transactionId: "tx-9" })
    ).toContain("(tx-9)");
  });
});
