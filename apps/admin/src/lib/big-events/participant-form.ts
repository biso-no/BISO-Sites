import { normalizePhone } from "@repo/shared/big-events/phone";
import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import { z } from "zod";
import { normalizeEmail } from "./import/normalize";

/** Campuses a participant can belong to: Oslo, Bergen, Trondheim, Stavanger. */
export const PARTICIPANT_CAMPUS_IDS = ["1", "2", "3", "4"] as const;
export type ParticipantCampusId = (typeof PARTICIPANT_CAMPUS_IDS)[number];

const isEmail = (value: string): boolean => z.email().safeParse(value).success;

/** Values the add and edit dialog sends. Empty text means "not set". */
export const participantFormSchema = z.object({
  campus_id: z.enum(PARTICIPANT_CAMPUS_IDS).nullable(),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().max(100),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value === "" || normalizePhone(value) !== null),
  ticket_email: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === "" || isEmail(value)),
});

export type ParticipantFormValues = z.infer<typeof participantFormSchema>;
export type ParticipantFormField = keyof ParticipantFormValues;

/** Narrows a stored campus id to one the form offers. */
export function toParticipantCampusId(
  value: string | null
): ParticipantCampusId | null {
  return PARTICIPANT_CAMPUS_IDS.find((id) => id === value) ?? null;
}

/**
 * The campus a new person starts on: the big event's campus when the caller
 * may give it (ruling R16), else no campus when they'd still see the person,
 * else the caller's first campus.
 */
export function defaultParticipantCampus(
  eventCampus: ParticipantCampusId | null,
  campusIds: ParticipantCampusId[],
  allowsNoCampus: boolean
): ParticipantCampusId | null {
  if (eventCampus && campusIds.includes(eventCampus)) {
    return eventCampus;
  }
  return allowsNoCampus ? null : (campusIds[0] ?? null);
}

export function emptyParticipantForm(
  campusId: ParticipantCampusId | null
): ParticipantFormValues {
  return {
    campus_id: campusId,
    first_name: "",
    last_name: "",
    phone: "",
    ticket_email: "",
  };
}

/** The dialog filled from a stored participant; null columns become empty text. */
export function participantFormInitial(
  row: Pick<
    BigEventParticipantRow,
    "campus_id" | "first_name" | "last_name" | "phone" | "ticket_email"
  >
): ParticipantFormValues {
  return {
    campus_id: toParticipantCampusId(row.campus_id),
    first_name: row.first_name,
    last_name: row.last_name ?? "",
    phone: row.phone ?? "",
    ticket_email: row.ticket_email ?? "",
  };
}

/** The row columns a validated form sets, stored the way imports store them. */
export function participantColumns(values: ParticipantFormValues) {
  return {
    campus_id: values.campus_id,
    first_name: values.first_name,
    last_name: values.last_name || null,
    phone: normalizePhone(values.phone),
    ticket_email: normalizeEmail(values.ticket_email),
  };
}
