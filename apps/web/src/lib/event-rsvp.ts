import "server-only";
import { createAdminClient } from "@repo/api/server";
import {
  type EventRsvpDb,
  type EventRsvpSummary,
  readEventRsvp,
} from "@repo/shared/utils/event-rsvp";
import { getLoggedInUser } from "@/lib/actions/user";

const DATABASE_ID = "app";

/** The RSVP helper's database, bound to the "app" database with admin rights. */
export async function createEventRsvpDb(): Promise<EventRsvpDb> {
  const { db } = await createAdminClient();
  return {
    createRow: (table, id, data, permissions) =>
      db.createRow(DATABASE_ID, table, id, data, permissions),
    deleteRow: (table, id) => db.deleteRow(DATABASE_ID, table, id),
    listRows: <T>(table: string, queries: string[]) =>
      db.listRows(DATABASE_ID, table, queries) as unknown as Promise<{
        rows: T[];
      }>,
    updateRow: (table, id, data) => db.updateRow(DATABASE_ID, table, id, data),
  };
}

/**
 * What the event page needs: whether the viewer is signed in, and the RSVP
 * summary (null hides the block). Never throws, so the page still renders.
 */
export async function readEventRsvpForViewer(
  eventId: string
): Promise<{ signedIn: boolean; summary: EventRsvpSummary | null }> {
  let signedIn = false;
  try {
    const session = await getLoggedInUser();
    signedIn = session !== null;
    const summary = await readEventRsvp(await createEventRsvpDb(), {
      eventId,
      now: new Date(),
      userId: session?.user.$id ?? null,
    });
    return { signedIn, summary };
  } catch (error) {
    console.error("Error reading event RSVP:", error);
    return { signedIn, summary: null };
  }
}
