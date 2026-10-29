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
