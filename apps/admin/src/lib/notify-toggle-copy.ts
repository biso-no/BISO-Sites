import { formatOsloDate, formatOsloTime } from "@repo/shared/utils/oslo-time";
import type { ContentNotificationState } from "./content-notification-state";

export interface NotifyToggleCopyInput {
  canNotifyNational: boolean;
  dueAtLabel?: string;
  isNational: boolean;
  isPublished: boolean;
  sentAtLabel?: string;
  state: ContentNotificationState;
}

export interface NotifyToggleCopy {
  description: string;
  disabled: boolean;
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

export function notifyToggleCopy(
  input: NotifyToggleCopyInput
): NotifyToggleCopy {
  const { state, isPublished, isNational, canNotifyNational } = input;

  if (state.kind === "sent") {
    const label = input.sentAtLabel ?? formatNotifyLabel(state.sentAt);
    return {
      description: label ? `Sent ${label}.` : "Sent.",
      disabled: false,
      showToggle: false,
      title: "Students were notified",
    };
  }
  if (state.kind === "skipped") {
    return {
      description: "This item can't send a notification.",
      disabled: false,
      showToggle: false,
      title: "Published before automatic notifications",
    };
  }

  const nationalBlocked = isNational && !canNotifyNational;

  if (state.kind === "pending") {
    const label = input.dueAtLabel ?? formatNotifyLabel(state.dueAt);
    return {
      description: nationalBlocked
        ? "Only national admins can notify every student."
        : `Goes out ${label || "soon"}. Untick to cancel.`,
      disabled: nationalBlocked,
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
  return { description, disabled: nationalBlocked, showToggle: true, title };
}

/** New items notify by default; existing items keep what was stored. */
export function defaultNotifyPush(
  stored: boolean | null | undefined,
  isNew: boolean
): boolean {
  return stored ?? isNew;
}
