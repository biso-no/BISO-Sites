/**
 * Checks for the Tickets & audience step, kept out of the editor so they can
 * be tested.
 *
 * Both are warnings shown under the field. The save itself still validates
 * `ticket_url` with `eventUpsertSchema`, but its failure is only a generic
 * "fix the form errors" toast that names no field.
 */

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Why a ticket link won't work as the event page's "Get tickets" button, or
 * null when it will (or is empty: the link is optional).
 */
export function ticketUrlProblem(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Paste the whole link, starting with https://";
  }
  if (!WEB_PROTOCOLS.has(url.protocol)) {
    return "Use a web link that starts with https://";
  }
  return null;
}

/**
 * Flags a member price above the regular one. It is always a mistake (a
 * paid event once went live with the two swapped), and the price card above
 * the inputs hides a member price that isn't lower, so it went unnoticed.
 */
export function memberPriceProblem(
  price: number | null | undefined,
  memberPrice: number | null | undefined
): string | null {
  const regular = price ?? 0;
  const member = memberPrice ?? 0;
  if (member > 0 && member > regular) {
    return "The member price is higher than the regular price. Are they swapped?";
  }
  return null;
}

/** The ticket link's host for the Review step, e.g. "secure.tickster.com". */
export function ticketLinkSummary(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed;
  }
}
