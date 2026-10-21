const NATIONAL_CAMPUS_ID = "5";

/**
 * National content reaches every campus, so only global admins may change
 * whether it sends an automatic push. Campus admins can edit National content
 * (they pass its write check) but keep whatever was stored.
 */
export function resolveNotifyPush(input: {
  requested: boolean;
  campusId: string | null | undefined;
  stored: boolean | null | undefined;
  isGlobalAdmin: boolean;
}): boolean {
  if (input.campusId === NATIONAL_CAMPUS_ID && !input.isGlobalAdmin) {
    return input.stored ?? false;
  }
  return input.requested;
}
