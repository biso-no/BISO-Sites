// Resolves the ordered expense approval chain, looking up department approvers
// in Microsoft Graph from BISO's curated user→department mapping.
//
// Department step (Oslo): search users whose `department` matches the expense
// department, then match the financial manager / manager / deputy by email
// prefix. Controller + national steps carry fixed mailboxes. When no department
// approver can be found, the step is dropped (falling back to the campus
// controller) and a remediation issue is returned for the admin app.

import type { GraphUser } from "@repo/connectors/azure/users";
import {
  type ApproverRole,
  getCampusApprovalPlan,
  getCampusEmailSlug,
  pickApproverByRole,
  ROLE_EMAIL_PREFIXES,
} from "@repo/shared/utils/expense-approvers";
import { getGraphService } from "./graph";

export interface ResolvedApproverStep {
  /** Azure AD object id, when the approver was resolved via Graph. */
  aadId: string | null;
  email: string;
  role: ApproverRole;
  step: number;
}

export interface ApproverResolutionIssue {
  campusId: string;
  department: string;
  reason: string;
  roleSought: ApproverRole;
}

export interface ApproverResolution {
  issue: ApproverResolutionIssue | null;
  steps: ResolvedApproverStep[];
}

interface ResolveInput {
  campusId: string;
  departmentName: string | null;
  /**
   * The authenticated submitter's mailbox. Used to verify a
   * `submitterIsFinancialManager` self-claim against the actual department
   * finance mailbox before honoring it.
   */
  submitterEmail: string | null;
  submitterIsFinancialManager: boolean;
}

type Candidate = GraphUser & { email?: string };

function toCandidate(user: GraphUser): Candidate {
  return { ...user, email: user.mail ?? user.userPrincipalName };
}

/**
 * Looks up the department approver (finance → or manager → deputy) for the
 * given role. Returns the matched Graph user or null.
 */
function resolveDepartmentApprover(
  candidates: Candidate[],
  role: "finance" | "manager",
  campusSlug: string
): { user: Candidate; role: ApproverRole } | null {
  if (role === "finance") {
    const match = pickApproverByRole(
      candidates,
      ROLE_EMAIL_PREFIXES.finance,
      campusSlug
    );
    return match ? { user: match, role: "finance" } : null;
  }

  const manager = pickApproverByRole(
    candidates,
    ROLE_EMAIL_PREFIXES.manager,
    campusSlug
  );
  if (manager) {
    return { user: manager, role: "manager" };
  }

  const deputy = pickApproverByRole(
    candidates,
    ROLE_EMAIL_PREFIXES.deputy,
    campusSlug
  );
  return deputy ? { user: deputy, role: "deputy" } : null;
}

export async function resolveExpenseApprovers(
  input: ResolveInput
): Promise<ApproverResolution> {
  const steps: ResolvedApproverStep[] = [];
  let issue: ApproverResolutionIssue | null = null;
  let departmentCandidates: Candidate[] | null = null;

  const loadCandidates = async (): Promise<Candidate[]> => {
    if (departmentCandidates) {
      return departmentCandidates;
    }
    if (!input.departmentName) {
      departmentCandidates = [];
      return departmentCandidates;
    }
    const users = await getGraphService().findUsersByDepartment(
      input.departmentName
    );
    departmentCandidates = users.map(toCandidate);
    return departmentCandidates;
  };

  const campusSlug = getCampusEmailSlug(input.campusId) ?? "";

  // Only honor the "I am the financial manager" toggle when the authenticated
  // submitter actually matches the department's finance mailbox. Without this,
  // any submitter could set the flag in the request body and skip the finance
  // approval step. When unverified, the flag is ignored and the normal finance
  // step is kept (fails safe toward more approval, never less).
  const submitterEmail = input.submitterEmail?.trim().toLowerCase() || null;
  let effectiveIsFinancialManager = false;
  if (input.submitterIsFinancialManager && submitterEmail) {
    const financeApprover = pickApproverByRole(
      await loadCandidates(),
      ROLE_EMAIL_PREFIXES.finance,
      campusSlug
    );
    effectiveIsFinancialManager =
      financeApprover?.email?.toLowerCase() === submitterEmail;
  }

  const plan = getCampusApprovalPlan({
    campusId: input.campusId,
    submitterIsFinancialManager: effectiveIsFinancialManager,
  });

  for (const planStep of plan) {
    if (planStep.kind === "fixed" && planStep.email) {
      steps.push({
        step: steps.length + 1,
        role: planStep.role,
        email: planStep.email,
        aadId: null,
      });
      continue;
    }

    // Department step (role is finance or manager).
    const departmentRole = planStep.role === "manager" ? "manager" : "finance";
    const candidates = await loadCandidates();
    const resolved = resolveDepartmentApprover(
      candidates,
      departmentRole,
      campusSlug
    );

    if (resolved?.user.email) {
      steps.push({
        step: steps.length + 1,
        role: resolved.role,
        email: resolved.user.email,
        aadId: resolved.user.id,
      });
    } else {
      issue = {
        campusId: input.campusId,
        department: input.departmentName ?? "(none)",
        roleSought: departmentRole,
        reason: input.departmentName
          ? `No ${departmentRole} mailbox found among users in department "${input.departmentName}".`
          : "Expense has no department set.",
      };
    }
  }

  return { steps, issue };
}
