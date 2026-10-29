import { JobsStatus } from "@repo/api/types/appwrite";

export type JobStatusTarget = JobsStatus.CLOSED | JobsStatus.PUBLISHED;

export type JobStatusTransition =
  | { error: string; ok?: never; warnDeadlinePassed?: never }
  | { error?: never; ok: true; warnDeadlinePassed: boolean };

/**
 * Closing is only offered for a live vacancy and reopening only for a closed
 * one. Reopening a vacancy whose application deadline has passed is allowed,
 * but the caller is told so the deadline can be moved.
 */
export function resolveJobStatusTransition(input: {
  applicationDeadline: string | null | undefined;
  currentStatus: string | null | undefined;
  now?: Date;
  target: JobStatusTarget;
}): JobStatusTransition {
  const { applicationDeadline, currentStatus, target } = input;
  if (target === JobsStatus.CLOSED) {
    if (currentStatus !== JobsStatus.PUBLISHED) {
      return { error: "Only a published vacancy can be closed." };
    }
    return { ok: true, warnDeadlinePassed: false };
  }
  if (currentStatus !== JobsStatus.CLOSED) {
    return { error: "Only a closed vacancy can be reopened." };
  }
  const deadline = applicationDeadline ? new Date(applicationDeadline) : null;
  const now = input.now ?? new Date();
  const passed =
    deadline !== null &&
    !Number.isNaN(deadline.getTime()) &&
    deadline.getTime() < now.getTime();
  return { ok: true, warnDeadlinePassed: passed };
}

/**
 * What the studio editor asks before "Save draft" takes a vacancy offline, or
 * null when nothing goes offline. A closed vacancy is already offline, so the
 * prompt says it stays offline and becomes a draft.
 */
export function saveDraftConfirmMessage(
  currentStatus: string | null | undefined
): string | null {
  if (currentStatus === JobsStatus.PUBLISHED) {
    return "This vacancy is live. Saving it as a draft takes it offline and it disappears from the public site. Continue?";
  }
  if (currentStatus === JobsStatus.CLOSED) {
    return "This vacancy is closed. Saving it as a draft keeps it offline and turns it into a draft. Continue?";
  }
  return null;
}

/**
 * Publishing a closed vacancy reopens it. When its application deadline has
 * passed the editor shows the same warning as the reopen action.
 */
export function publishDeadlineWarning(input: {
  applicationDeadline: string | null | undefined;
  currentStatus: string | null | undefined;
  now?: Date;
}): string | null {
  const transition = resolveJobStatusTransition({
    ...input,
    target: JobsStatus.PUBLISHED,
  });
  return transition.warnDeadlinePassed
    ? "Vacancy published, but its application deadline has passed. Move the deadline so people can apply."
    : null;
}
