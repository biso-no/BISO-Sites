import {
  isNotificationTopic,
  logicalTopicFor,
  resolveAnnouncementTopicId,
  topicIdFor,
} from "@repo/shared/utils/notification-topics";
import { CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";

const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;
const GLOBAL_ADMIN_ROLE = "globaladmin";
const CAMPUS_ADMIN_ROLE = "campusadmin";

export const SEND_FORBIDDEN_MESSAGE =
  "Only campus and national admins can send notifications.";
export const AUDIENCE_FORBIDDEN_MESSAGE = "You can't send to that audience.";
export const ALREADY_SENT_MESSAGE = "This announcement has already been sent.";
export const NO_PEOPLE_MESSAGE = "Add at least one person.";

export type AudienceType = "broadcast" | "topic" | "users" | "segment";

export interface AudienceRequest {
  audienceType: AudienceType;
  campusId: string | null;
  segmentCampusId?: string | null;
}

export interface AudienceContext {
  managedCampusIds: string[];
  roles: string[];
}

export function canSendNotifications(roles: string[]): boolean {
  return roles.includes(GLOBAL_ADMIN_ROLE) || roles.includes(CAMPUS_ADMIN_ROLE);
}

function isNationalOrUnset(campusId: string | null | undefined): boolean {
  return !campusId || campusId === NATIONAL_CAMPUS_ID;
}

export function isAudienceAllowed(
  ctx: AudienceContext,
  req: AudienceRequest
): boolean {
  if (ctx.roles.includes(GLOBAL_ADMIN_ROLE)) {
    return true;
  }
  if (!ctx.roles.includes(CAMPUS_ADMIN_ROLE)) {
    return false;
  }
  switch (req.audienceType) {
    case "users":
      return true;
    case "segment":
      return Boolean(
        req.segmentCampusId &&
          ctx.managedCampusIds.includes(req.segmentCampusId)
      );
    case "broadcast":
    case "topic":
      return (
        !isNationalOrUnset(req.campusId) &&
        ctx.managedCampusIds.includes(req.campusId as string)
      );
    default:
      return false;
  }
}

/** Campus choices the composer may offer for an audience type. */
export function allowedCampusChoices(
  ctx: AudienceContext,
  audienceType: AudienceType
): { campusIds: string[]; allCampuses: boolean } {
  if (ctx.roles.includes(GLOBAL_ADMIN_ROLE)) {
    return {
      allCampuses: audienceType === "broadcast" || audienceType === "topic",
      campusIds: Object.values(
        CAMPUS_NAME_TO_ID as Record<string, string>
      ).filter((id) => id !== NATIONAL_CAMPUS_ID),
    };
  }
  if (!ctx.roles.includes(CAMPUS_ADMIN_ROLE)) {
    return { allCampuses: false, campusIds: [] };
  }
  return {
    allCampuses: false,
    campusIds: ctx.managedCampusIds.filter((id) => id !== NATIONAL_CAMPUS_ID),
  };
}

/**
 * A topic audience must name a real logical topic, either bare or as exactly
 * that topic's channel for the row's campus. Dispatch passes any other value
 * through unchanged, which would reach another campus or every device.
 */
export function isTopicValueAllowed(
  value: string | null | undefined,
  campusId: string | null | undefined
): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  const logical = logicalTopicFor(trimmed === "products" ? "shop" : trimmed);
  if (!isNotificationTopic(logical)) {
    return false;
  }
  return (
    resolveAnnouncementTopicId(trimmed, campusId) ===
    topicIdFor(logical, campusId)
  );
}
