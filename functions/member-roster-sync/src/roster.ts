/**
 * Pure roster assembly: which customers are current members, which plan to
 * show, and which campus they belong to. No I/O — `main.ts` feeds it.
 */

import type {
  Company,
  CustomerCategoryMapping,
  MembershipInvoiceLine,
} from "@repo/connectors/24sevenoffice";

export interface ActivePlan {
  categoryId: number;
  /** `YYYY-MM-DD`. */
  expiryDate: string;
  name: string;
  productId: number;
}

/** The `memberships` columns this module reads. */
export interface PlanRow {
  category: string | null;
  expiryDate: string;
  membership_id: string;
  name: string;
}

export interface RosterRow {
  $id: string;
  campus_id: string | null;
  company_id: number;
  email: string | null;
  expiry_date: string;
  invoiced_at: string | null;
  membership_id: string;
  membership_name: string;
  name: string;
  sync_run_id: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const NORWEGIAN_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/**
 * `memberships.expiryDate` is written as ISO by the product sync but has been
 * edited to `DD.MM.YYYY` in production, so accept both. Returns `YYYY-MM-DD`,
 * or null when the value is neither.
 */
function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = ISO_DATE.exec(trimmed);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const norwegian = NORWEGIAN_DATE.exec(trimmed);
  if (norwegian) {
    return `${norwegian[3]}-${norwegian[2]}-${norwegian[1]}`;
  }
  return null;
}

/** Unexpired plans keyed by their 24SO category id. `today` is `YYYY-MM-DD`. */
export function selectActivePlans(
  rows: PlanRow[],
  today: string
): Map<number, ActivePlan> {
  const plans = new Map<number, ActivePlan>();
  for (const row of rows) {
    const categoryId = Number.parseInt(row.category ?? "", 10);
    const productId = Number.parseInt(row.membership_id, 10);
    const expiryDate = toIsoDate(row.expiryDate);
    if (
      Number.isFinite(categoryId) &&
      Number.isFinite(productId) &&
      expiryDate !== null &&
      expiryDate >= today
    ) {
      plans.set(categoryId, {
        categoryId,
        expiryDate,
        name: row.name,
        productId,
      });
    }
  }
  return plans;
}

/** One plan per member company: the active plan that expires latest. */
export function foldMembers(
  pairs: CustomerCategoryMapping[],
  plans: Map<number, ActivePlan>
): Map<number, ActivePlan> {
  const members = new Map<number, ActivePlan>();
  for (const { categoryId, companyId } of pairs) {
    const plan = plans.get(categoryId);
    if (!plan) {
      continue;
    }
    const current = members.get(companyId);
    if (!current || plan.expiryDate > current.expiryDate) {
      members.set(companyId, plan);
    }
  }
  return members;
}

function latestLineByCustomer(
  lines: MembershipInvoiceLine[]
): Map<number, MembershipInvoiceLine> {
  const latest = new Map<number, MembershipInvoiceLine>();
  for (const line of lines) {
    const current = latest.get(line.customerId);
    if (!current || (line.invoicedAt ?? "") > (current.invoicedAt ?? "")) {
      latest.set(line.customerId, line);
    }
  }
  return latest;
}

/** 24SO stores student emails under Work, so Primary alone is not enough. */
function emailOf(company: Company | undefined): string | null {
  const addresses = company?.EmailAddresses;
  const email =
    addresses?.Primary?.Value ??
    addresses?.Work?.Value ??
    addresses?.Home?.Value ??
    addresses?.Invoice?.Value ??
    addresses?.Alternative?.Value;
  return email?.trim() || null;
}

export function buildRosterRows(input: {
  companies: Company[];
  invoiceLines: MembershipInvoiceLine[];
  members: Map<number, ActivePlan>;
  runId: string;
  validCampusIds: ReadonlySet<string>;
}): RosterRow[] {
  const companies = new Map<number, Company>();
  for (const company of input.companies) {
    if (typeof company.Id === "number") {
      companies.set(company.Id, company);
    }
  }
  const invoices = latestLineByCustomer(input.invoiceLines);
  const rows: RosterRow[] = [];

  for (const [companyId, plan] of input.members) {
    const company = companies.get(companyId);
    const invoice = invoices.get(companyId);
    const campusId = invoice?.campusId ?? null;

    rows.push({
      $id: String(companyId),
      campus_id:
        campusId && input.validCampusIds.has(campusId) ? campusId : null,
      company_id: companyId,
      email: emailOf(company),
      expiry_date: plan.expiryDate,
      invoiced_at: invoice?.invoicedAt ?? null,
      membership_id: String(plan.productId),
      membership_name: plan.name,
      // ~15% of tree members have no company record; the invoice still names them.
      name: company?.Name?.trim() || invoice?.customerName || "",
      sync_run_id: input.runId,
    });
  }

  return rows;
}
