import { BIG_EVENT_STATUSES } from "@repo/shared/big-events/tables";
import type { BigEventRow } from "@repo/shared/big-events/types";
import { z } from "zod";
import { autoTextsSchema } from "./messages/auto-texts";

/** Campuses a big event can belong to: Oslo, Bergen, Trondheim, Stavanger, National. */
export const BIG_EVENT_CAMPUS_IDS = ["1", "2", "3", "4", "5"] as const;

const dateTime = z.iso.datetime({ offset: true });
const WEB_PROTOCOL = /^https?$/;

const bigEventFields = z.object({
  campus_id: z.enum(BIG_EVENT_CAMPUS_IDS),
  department_id: z.string().min(1).max(36).nullable(),
  ends_at: dateTime,
  group_checkin_enabled: z.boolean(),
  hero_image_url: z.url({ protocol: WEB_PROTOCOL }).max(1000).or(z.literal("")),
  name_en: z.string().trim().max(200),
  name_no: z.string().trim().min(1).max(200),
  place_address: z.string().trim().max(300),
  place_name: z.string().trim().max(200),
  starts_at: dateTime,
  travel_enabled: z.boolean(),
});

type BigEventFields = z.infer<typeof bigEventFields>;

const endsAfterStart = (values: BigEventFields): boolean =>
  Date.parse(values.starts_at) < Date.parse(values.ends_at);
const END_BEFORE_START = {
  message: "The end must be after the start",
  path: ["ends_at"],
};

/** Values the create and settings form sends. Empty text means "not set". */
export const bigEventFormSchema = bigEventFields.refine(
  endsAfterStart,
  END_BEFORE_START
);

/**
 * The settings form also sets the status and, when it sends them, the
 * automatic messages (plan M9): three switches and the organizers' own
 * texts (null: the defaults). Left out, they stay as they are.
 */
export const bigEventUpdateSchema = bigEventFields
  .extend({
    auto_bus_assigned: z.boolean().optional(),
    auto_bus_moved: z.boolean().optional(),
    auto_departure_reminder: z.boolean().optional(),
    auto_texts: autoTextsSchema.nullable().optional(),
    status: z.enum(BIG_EVENT_STATUSES),
  })
  .refine(endsAfterStart, END_BEFORE_START);

export type BigEventFormValues = z.infer<typeof bigEventFormSchema>;
export type BigEventUpdateValues = z.infer<typeof bigEventUpdateSchema>;
export type BigEventFormField = keyof BigEventUpdateValues;

export type BigEventCampusId = (typeof BIG_EVENT_CAMPUS_IDS)[number];

/** Narrows a stored campus id to one the form offers. */
export function toBigEventCampusId(value: string): BigEventCampusId | null {
  return BIG_EVENT_CAMPUS_IDS.find((id) => id === value) ?? null;
}

/** A blank create form on the given campus. */
export function emptyBigEventForm(
  campusId: BigEventCampusId
): BigEventUpdateValues {
  return {
    campus_id: campusId,
    department_id: null,
    ends_at: "",
    group_checkin_enabled: false,
    hero_image_url: "",
    name_en: "",
    name_no: "",
    place_address: "",
    place_name: "",
    starts_at: "",
    status: "draft",
    travel_enabled: false,
  };
}

/** The settings form filled from a stored big event; null columns become empty text. */
export function bigEventFormInitial(
  event: BigEventRow,
  campusId: BigEventCampusId
): BigEventUpdateValues {
  return {
    campus_id: campusId,
    department_id: event.department_id,
    ends_at: event.ends_at,
    group_checkin_enabled: event.group_checkin_enabled ?? false,
    hero_image_url: event.hero_image_url ?? "",
    name_en: event.name_en ?? "",
    name_no: event.name_no,
    place_address: event.place_address ?? "",
    place_name: event.place_name ?? "",
    starts_at: event.starts_at,
    status: event.status ?? "draft",
    travel_enabled: event.travel_enabled ?? false,
  };
}

/** The row columns a validated form sets; empty text becomes null. */
export function bigEventColumns(values: BigEventFormValues) {
  return {
    campus_id: values.campus_id,
    department_id: values.department_id,
    ends_at: values.ends_at,
    group_checkin_enabled: values.group_checkin_enabled,
    hero_image_url: values.hero_image_url || null,
    name_en: values.name_en || null,
    name_no: values.name_no,
    place_address: values.place_address || null,
    place_name: values.place_name || null,
    starts_at: values.starts_at,
    travel_enabled: values.travel_enabled,
  };
}

/** The automatic-message switches the form sent; the ones left out stay as they are. */
export function autoMessageSwitches(values: BigEventUpdateValues) {
  return {
    ...(values.auto_bus_assigned === undefined
      ? {}
      : { auto_bus_assigned: values.auto_bus_assigned }),
    ...(values.auto_bus_moved === undefined
      ? {}
      : { auto_bus_moved: values.auto_bus_moved }),
    ...(values.auto_departure_reminder === undefined
      ? {}
      : { auto_departure_reminder: values.auto_departure_reminder }),
  };
}
