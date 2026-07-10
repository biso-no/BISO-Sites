/**
 * Pure helpers for the inbox realtime provider. Plain module (NOT
 * "use server") so it can export sync functions and constants.
 */

export function isCreateEvent(events: string[]): boolean {
  return events.some((event) => event.endsWith(".create"));
}

export function eventTouchesTable(events: string[], tableId: string): boolean {
  const marker = `.tables.${tableId}.`;
  return events.some((event) => event.includes(marker));
}

/**
 * Cosmetic toast filter for globaladmins scoped to a campus. Counts are
 * always server-computed; this only suppresses irrelevant toasts.
 */
export function shouldNotifyForCampus(
  payloadCampusId: string | null,
  activeCampusId: string | null
): boolean {
  if (!(payloadCampusId && activeCampusId)) {
    return true;
  }
  return payloadCampusId === activeCampusId;
}
