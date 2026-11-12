import { describe, expect, test } from "bun:test";
import { loadMessages } from "@repo/i18n/messages";

interface ExpenseMessages {
  changeApprover: Record<string, string>;
  decision: Record<string, string>;
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
});
