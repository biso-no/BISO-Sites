// The hint codes of an expense in plain words, for the surfaces outside admin:
// the Teams card and approval email (English) and the accounting cover sheet
// (Norwegian, like the rest of that PDF). The api has no i18n, so these are
// hand copies of `adminPortal.expenses.hintsText.*` and `issues.*`
// (packages/i18n/messages/{en,no}/adminPortal.json); keep them in step.

import {
  type ApproverHint,
  hintTextKey,
} from "@repo/shared/utils/expense-hints";

export type HintLocale = "en" | "nb";

const PLACEHOLDER = /\{(\w+)\}/g;

// English copies of the admin's `adminPortal.expenses.hintsText.*` strings.
const HINT_TEXT_EN: Record<string, string> = {
  account_missing: "No account is set for this receipt type.",
  ai_check_disagrees:
    'The student chose a type the AI would not have picked. The AI suggests "{aiType}".',
  ai_check_incomplete:
    "The AI check did not finish, so the AI has not looked at everything on this expense.",
  ai_account_unsure: "The AI was not sure which account to use.",
  amount_differs: "Entered amount is {entered}, but the receipt reads {read}.",
  app_type_replaced: 'The app said "{appType}"; the AI chose "{aiType}".',
  occasion_missing: "The occasion is missing.",
  old_receipt: "The receipt is {days} days old.",
  possible_duplicate: "Possible duplicate of another receipt.",
  possible_duplicate_number:
    "Possible duplicate of expense {reimbursementNumber}.",
  project_missing: "No project was found for this expense.",
  project_not_created:
    "The project for {series} {year} has not been created yet.",
  project_unsure: "The AI was not sure which project this belongs to.",
  project_unsure_reason:
    "The AI was not sure which project this belongs to: {reason}",
  receipt_issue: "Receipt problem: {issue}.",
  type_defaulted: "No type was chosen, so Other was used.",
  type_unsure: "The AI was not sure which type this receipt is.",
  type_unsure_reason:
    "The AI was not sure which type this receipt is: {reason}",
};

// English copies of `adminPortal.expenses.issues.*` for `receipt_issue` hints.
const RECEIPT_ISSUE_TEXT_EN: Record<string, string> = {
  missing_date: "Date missing",
  missing_seller: "Seller missing",
  missing_total: "Total missing",
  no_items: "No items listed",
  not_a_receipt: "Does not look like a receipt",
  unreadable: "Hard to read",
};

const HINT_TEXT_NB: Record<string, string> = {
  account_missing: "Det er ikke satt en konto for denne kvitteringstypen.",
  ai_check_disagrees:
    "Studenten valgte en type som AI ikke ville valgt. AI foreslår «{aiType}».",
  ai_check_incomplete:
    "AI-sjekken ble ikke ferdig, så AI har ikke sett på alt i dette utlegget.",
  ai_account_unsure: "AI var usikker på hvilken konto som skulle brukes.",
  amount_differs: "Oppgitt beløp er {entered}, men kvitteringen viser {read}.",
  app_type_replaced: "Appen sa «{appType}», men AI valgte «{aiType}».",
  occasion_missing: "Anledning mangler.",
  old_receipt: "Kvitteringen er {days} dager gammel.",
  possible_duplicate: "Kan være en dublett av en annen kvittering.",
  possible_duplicate_number:
    "Kan være en dublett av utlegg {reimbursementNumber}.",
  project_missing: "Det ble ikke funnet noe prosjekt for dette utlegget.",
  project_not_created: "Prosjektet for {series} {year} er ikke opprettet ennå.",
  project_unsure: "AI var usikker på hvilket prosjekt dette hører til.",
  project_unsure_reason:
    "AI var usikker på hvilket prosjekt dette hører til: {reason}",
  receipt_issue: "Problem med kvitteringen: {issue}.",
  type_defaulted: "Ingen type ble valgt, så Annet ble brukt.",
  type_unsure: "AI var usikker på hvilken type denne kvitteringen er.",
  type_unsure_reason:
    "AI var usikker på hvilken type denne kvitteringen er: {reason}",
};

const RECEIPT_ISSUE_TEXT_NB: Record<string, string> = {
  missing_date: "Dato mangler",
  missing_seller: "Selger mangler",
  missing_total: "Sum mangler",
  no_items: "Ingen varelinjer",
  not_a_receipt: "Ser ikke ut som en kvittering",
  unreadable: "Vanskelig å lese",
};

const TEXTS = {
  en: { hints: HINT_TEXT_EN, issues: RECEIPT_ISSUE_TEXT_EN },
  nb: { hints: HINT_TEXT_NB, issues: RECEIPT_ISSUE_TEXT_NB },
} as const;

function fill(template: string, data: Record<string, string | number>) {
  return template.replace(PLACEHOLDER, (_, key: string) =>
    String(data[key] ?? "")
  );
}

/** The hint in words, or null for a code with no text. */
export function hintSentence(
  hint: ApproverHint,
  typeLabels: Map<string, string>,
  locale: HintLocale = "en"
): string | null {
  const texts = TEXTS[locale];
  const data = { ...hint.data };
  if (typeof data.aiType === "string") {
    data.aiType = typeLabels.get(data.aiType) ?? data.aiType;
  }
  if (hint.code === "receipt_issue") {
    const issue = String(data.issue ?? "");
    return fill(texts.hints.receipt_issue ?? "", {
      issue: texts.issues[issue] ?? issue,
    });
  }
  const template = texts.hints[hintTextKey(hint.code, data)];
  return template ? fill(template, data) : null;
}
