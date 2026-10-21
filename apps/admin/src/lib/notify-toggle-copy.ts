import { formatOsloDate, formatOsloTime } from "@repo/shared/utils/oslo-time";
import type { ContentNotificationState } from "./content-notification-state";
import { NATIONAL_CAMPUS_ID } from "./event-scope";
import { resolveNotifyPush } from "./notify-push-guard";

export interface NotifyToggleCopyInput {
  campusId?: string | null;
  canNotifyNational: boolean;
  dueAtLabel?: string;
  isNational: boolean;
  isPublished: boolean;
  /** The form's current notify value (may be unsaved). */
  requested?: boolean;
  sentAtLabel?: string;
  state: ContentNotificationState;
  stored?: boolean | null;
  storedCampusId?: string | null;
}

export interface NotifyToggleCopy {
  description: string;
  disabled: boolean;
  /** What the server will save: the toggle's displayed state. */
  effectiveOn: boolean;
  showToggle: boolean;
  title: string;
}

/** "Mon 2 Nov at 08:00" in Oslo time, or "" for an invalid date. */
export function formatNotifyLabel(iso: string): string {
  const date = formatOsloDate(
    iso,
    { day: "numeric", month: "short", weekday: "short" },
    "en-GB"
  );
  const time = formatOsloTime(iso);
  if (!(date && time)) {
    return "";
  }
  return `${date.replace(",", "")} at ${time}`;
}

function pendingDescription(
  label: string,
  nationalBlocked: boolean,
  effectiveOn: boolean
): string {
  const when = label || "soon";
  if (nationalBlocked) {
    return `Goes out ${when}. Only national admins can change this.`;
  }
  if (!effectiveOn) {
    return "Will be cancelled when you save.";
  }
  return `Goes out ${when}. Untick to cancel.`;
}

export function notifyToggleCopy(
  input: NotifyToggleCopyInput
): NotifyToggleCopy {
  const { state, isPublished, isNational, canNotifyNational } = input;
  const requested = input.requested ?? true;
  const effectiveOn = resolveNotifyPush({
    campusId: input.campusId ?? (isNational ? NATIONAL_CAMPUS_ID : null),
    isGlobalAdmin: canNotifyNational,
    requested,
    stored: input.stored ?? null,
    storedCampusId: input.storedCampusId ?? null,
  });

  if (state.kind === "sent") {
    const label = input.sentAtLabel ?? formatNotifyLabel(state.sentAt);
    return {
      description: label ? `Sent ${label}.` : "Sent.",
      disabled: false,
      effectiveOn,
      showToggle: false,
      title: "Students were notified",
    };
  }
  if (state.kind === "skipped") {
    return {
      description: "This item can't send a notification.",
      disabled: false,
      effectiveOn,
      showToggle: false,
      title: "Published before automatic notifications",
    };
  }

  const nationalBlocked = isNational && !canNotifyNational;

  if (state.kind === "pending") {
    const label = input.dueAtLabel ?? formatNotifyLabel(state.dueAt);
    return {
      description: pendingDescription(label, nationalBlocked, effectiveOn),
      disabled: nationalBlocked,
      effectiveOn,
      showToggle: true,
      title: "Notification scheduled",
    };
  }

  const title = isPublished
    ? "Notify students now"
    : "Notify students when published";
  let description = isPublished
    ? "Sends one notification to students who follow this topic, a few minutes after you save."
    : "Students who follow this topic get one notification when it goes live.";
  if (nationalBlocked) {
    description = "Only national admins can notify every student.";
  }
  return {
    description,
    disabled: nationalBlocked,
    effectiveOn,
    showToggle: true,
    title,
  };
}

/** New items notify by default; existing items keep what was stored. */
export function defaultNotifyPush(
  stored: boolean | null | undefined,
  isNew: boolean
): boolean {
  return stored ?? isNew;
}
