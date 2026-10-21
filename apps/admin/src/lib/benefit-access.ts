import {
  CAMPUS_IDS,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";
import { ROLES } from "./roles";

/** Every campus id a benefit can belong to: the four campuses plus national. */
export const BENEFIT_EDITABLE_ALL: readonly string[] = [
  ...CAMPUS_IDS,
  NATIONAL_CAMPUS_ID,
];

const EMAIL_SEPARATOR = /[\s,;]+/;

export function parseBenefitEditorEmails(
  value: string | undefined
): Set<string> {
  const emails = new Set<string>();
  for (const part of (value ?? "").split(EMAIL_SEPARATOR)) {
    const email = part.trim().toLowerCase();
    if (email) {
      emails.add(email);
    }
  }
  return emails;
}

export function isBenefitEditorEmail(
  email: string | null | undefined,
  configured: string | undefined = process.env.BENEFITS_EDITOR_EMAILS
): boolean {
  if (!email) {
    return false;
  }
  return parseBenefitEditorEmails(configured).has(email.trim().toLowerCase());
}

const MICROSOFT_PROVIDER = "microsoft";

/**
 * True when some Microsoft OAuth identity carries a configured editor email.
 * The account email alone is not trusted: anonymous/email-password sessions
 * can set any address, while a Microsoft identity is vouched for by Azure AD.
 */
export function hasVerifiedBenefitEditorIdentity(
  identities: { provider: string; providerEmail?: string | null }[],
  configured: string | undefined = process.env.BENEFITS_EDITOR_EMAILS
): boolean {
  return identities.some(
    (identity) =>
      identity.provider === MICROSOFT_PROVIDER &&
      isBenefitEditorEmail(identity.providerEmail, configured)
  );
}

export interface BenefitAccess {
  editableCampusIds: string[];
  visibleCampusIds: string[];
}

interface BenefitAccessContext {
  managedCampusIds: string[];
  roles: string[];
}

export function benefitAccessFor(ctx: BenefitAccessContext): BenefitAccess {
  if (
    ctx.roles.includes(ROLES.GLOBAL_ADMIN) ||
    ctx.roles.includes(ROLES.BENEFITS_EDITOR)
  ) {
    return {
      editableCampusIds: [...BENEFIT_EDITABLE_ALL],
      visibleCampusIds: [...BENEFIT_EDITABLE_ALL],
    };
  }
  if (ctx.roles.includes(ROLES.CAMPUS_ADMIN)) {
    const editableCampusIds = CAMPUS_IDS.filter((id) =>
      ctx.managedCampusIds.includes(id)
    );
    return {
      editableCampusIds,
      visibleCampusIds:
        editableCampusIds.length > 0
          ? [...editableCampusIds, NATIONAL_CAMPUS_ID]
          : [],
    };
  }
  return { editableCampusIds: [], visibleCampusIds: [] };
}

export function canEditBenefitCampus(
  access: BenefitAccess,
  campusId: string | null | undefined
): boolean {
  return Boolean(campusId) && access.editableCampusIds.includes(campusId ?? "");
}

export function assertBenefitCampusWrite(
  ctx: BenefitAccessContext,
  campusId: string | null | undefined
): void {
  if (!canEditBenefitCampus(benefitAccessFor(ctx), campusId)) {
    throw new Error("Unauthorized: no write access to this campus");
  }
}

/** Global admin or benefits editor. */
export function canManageMembershipTexts(ctx: { roles: string[] }): boolean {
  return (
    ctx.roles.includes(ROLES.GLOBAL_ADMIN) ||
    ctx.roles.includes(ROLES.BENEFITS_EDITOR)
  );
}
