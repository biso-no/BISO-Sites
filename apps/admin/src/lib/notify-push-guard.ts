import { NATIONAL_CAMPUS_ID } from "./event-scope";

/**
 * National content reaches every campus, so only global admins may turn its
 * automatic push on. Campus admins can edit National content (they pass its
 * write check) but keep whatever was stored, and only when the row was already
 * National before this save: moving content into National never carries a
 * flag a global admin did not set there.
 */
export function resolveNotifyPush(input: {
  requested: boolean;
  campusId: string | null | undefined;
  stored: boolean | null | undefined;
  storedCampusId: string | null | undefined;
  isGlobalAdmin: boolean;
}): boolean {
  if (input.campusId === NATIONAL_CAMPUS_ID && !input.isGlobalAdmin) {
    return input.storedCampusId === NATIONAL_CAMPUS_ID
      ? (input.stored ?? false)
      : false;
  }
  return input.requested;
}
