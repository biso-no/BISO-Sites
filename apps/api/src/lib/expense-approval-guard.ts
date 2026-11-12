// Keeps an approval chain from routing to the submitter or to one person twice.
// Pure: runs on the resolved chain, after `resolveExpenseApprovers`.

import {
  type ApproverRole,
  DEFAULT_DIRECTORY_EMAILS,
} from "@repo/shared/utils/expense-approvers";
import type {
  ApproverResolutionIssue,
  ResolvedApproverStep,
} from "./expense-approver-resolution";

const NATIONAL_CAMPUS_ID = "5";

/** A chain step. A substitute for the submitter has no directory entry. */
export type GuardedApproverStep = Omit<ResolvedApproverStep, "directoryKey"> & {
  directoryKey: string | null;
};

export interface GuardedChain {
  issues: ApproverResolutionIssue[];
  steps: GuardedApproverStep[];
}

export interface GuardContext {
  campusId: string;
  departmentName: string | null;
}

const normalise = (email: string): string => email.trim().toLowerCase();

/**
 * The substitutes for a step whose approver is the submitter, best first.
 * Department roles have none: the controller step after them still approves.
 */
function substitutesFor(
  step: ResolvedApproverStep,
  campusId: string
): Omit<GuardedApproverStep, "step">[] {
  const national = DEFAULT_DIRECTORY_EMAILS[NATIONAL_CAMPUS_ID]?.national;
  const candidates: Omit<GuardedApproverStep, "step">[] = [];
  const add = (
    email: string | undefined,
    role: ApproverRole,
    fallbackFor?: ApproverRole
  ) => {
    if (email) {
      candidates.push({
        aadId: null,
        directoryKey: null,
        email,
        fallbackFor,
        role,
        source: "default",
      });
    }
  };
  // `fallbackFor` is set only for the national approver standing in for a role
  // that is not national, as resolution marks it.
  if (step.role === "controller") {
    add(DEFAULT_DIRECTORY_EMAILS[campusId]?.controller, "controller");
    add(national, "national", "controller");
  } else if (step.role === "president") {
    add(national, "national", "president");
  }
  return candidates;
}

/**
 * A step whose approver is the submitter is replaced by the first substitute
 * that is not the submitter (controller: the campus default mailbox, then
 * national; president: national), or dropped when there is none, so the next
 * step still approves. Either way it records "Approver is the submitter". Of
 * two steps with the same approver the earlier is dropped (the later is the
 * stronger role), with an issue. Surviving steps are renumbered from 1.
 */
export function guardChain(
  context: GuardContext,
  resolved: {
    issues: ApproverResolutionIssue[];
    steps: ResolvedApproverStep[];
  },
  submitterEmail: string | null
): GuardedChain {
  const issues = [...resolved.issues];
  const submitter = submitterEmail ? normalise(submitterEmail) : null;
  const issueFor = (
    step: Pick<ResolvedApproverStep, "fallbackFor" | "role">,
    reason: string
  ): ApproverResolutionIssue => ({
    campusId: context.campusId,
    department: context.departmentName ?? "(none)",
    reason,
    roleSought: step.fallbackFor ?? step.role,
  });

  const routed: GuardedApproverStep[] = [];
  for (const step of resolved.steps) {
    if (!submitter || normalise(step.email) !== submitter) {
      routed.push(step);
      continue;
    }
    const substitute = substitutesFor(step, context.campusId).find(
      (candidate) => normalise(candidate.email) !== submitter
    );
    if (substitute) {
      issues.push(
        issueFor(
          step,
          `Approver is the submitter; sent to ${substitute.email} instead`
        )
      );
      routed.push({ ...substitute, step: step.step });
    } else {
      issues.push(issueFor(step, "Approver is the submitter"));
    }
  }

  const kept = routed.filter((step, index) => {
    const later = routed
      .slice(index + 1)
      .find((other) => normalise(other.email) === normalise(step.email));
    if (later) {
      issues.push(
        issueFor(
          step,
          `Same approver as the ${later.role} step; the earlier ${step.role} step was dropped`
        )
      );
      return false;
    }
    return true;
  });
  return {
    issues,
    steps: kept.map((step, index) => ({ ...step, step: index + 1 })),
  };
}
