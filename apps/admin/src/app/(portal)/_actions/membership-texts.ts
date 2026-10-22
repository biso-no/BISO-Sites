"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { MembershipTexts } from "@repo/api/types/appwrite";
import { loadMessages } from "@repo/i18n";
import {
  MEMBERSHIP_TEXT_BODY_MAX,
  MEMBERSHIP_TEXT_MAX_ITEMS,
  MEMBERSHIP_TEXT_SPOT_META,
  MEMBERSHIP_TEXT_SPOTS,
  MEMBERSHIP_TEXT_TITLE_MAX,
  type MembershipTextSpot,
  membershipTextRowId,
  resolveDefaultItems,
} from "@repo/shared/utils/membership-texts";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { canManageMembershipTexts } from "@/lib/benefit-access";
import { translateContentFields } from "@/lib/content-translation.server";
import { notifyWebsite } from "@/lib/web-revalidate";
import { logAuditEvent } from "./audit-log";

const TABLE = "membership_texts";
const TEXTS_PATH = "/benefits/texts";
const ROW_LIMIT = 200;
const UNAUTHORIZED = "Unauthorized";

/** Plain Norwegian messages for the editors, kept in one place. */
const TEXT_ERRORS = {
  noItems: "Legg til minst ett punkt.",
  saveFailed: "Kunne ikke lagre teksten. Prøv igjen om litt.",
  resetFailed: "Kunne ikke tilbakestille teksten. Prøv igjen om litt.",
  tooMany: `Maks ${MEMBERSHIP_TEXT_MAX_ITEMS} punkter.`,
  titleMissing: "Hvert punkt må ha en tittel på norsk.",
  titleTooLong: `Tittelen kan ha maks ${MEMBERSHIP_TEXT_TITLE_MAX} tegn.`,
  bodyTooLong: `Teksten kan ha maks ${MEMBERSHIP_TEXT_BODY_MAX} tegn.`,
  unknownSpot: "Ukjent tekstplassering.",
} as const;

export interface MembershipSpotItem {
  body_en: string;
  body_nb: string;
  title_en: string;
  title_nb: string;
}

export interface MembershipSpotData {
  hasRows: boolean;
  items: MembershipSpotItem[];
  spot: MembershipTextSpot;
}

export interface MembershipSpotInputItem {
  body_en?: string;
  body_nb?: string;
  title_en?: string;
  title_nb: string;
}

type ActionResult = { data: true } | { error: string };
type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

const isSpot = (value: unknown): value is MembershipTextSpot =>
  MEMBERSHIP_TEXT_SPOTS.includes(value as MembershipTextSpot);

const requireTextEditor = async () => {
  const ctx = await requireAuth();
  return canManageMembershipTexts(ctx) ? ctx : null;
};

const trimmed = (value: string | null | undefined): string =>
  value?.trim() ?? "";

const listSpotRows = async (
  db: AdminDb,
  spot: MembershipTextSpot
): Promise<MembershipTexts[]> => {
  const result = await db.listRows<MembershipTexts>("app", TABLE, [
    Query.equal("spot", spot),
    Query.limit(ROW_LIMIT),
  ]);
  return result.rows;
};

export async function loadMembershipTexts(): Promise<MembershipSpotData[]> {
  const ctx = await requireTextEditor();
  if (!ctx) {
    throw new Error(UNAUTHORIZED);
  }
  const { db } = await createAdminClient();
  const [result, no, en] = await Promise.all([
    db.listRows<MembershipTexts>("app", TABLE, [
      Query.orderAsc("sort_order"),
      Query.limit(ROW_LIMIT),
    ]),
    loadMessages("no"),
    loadMessages("en"),
  ]);

  return MEMBERSHIP_TEXT_SPOTS.map((spot) => {
    const rows = result.rows
      .filter((row) => row.spot === spot)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (rows.length > 0) {
      return {
        hasRows: true,
        items: rows.map((row) => ({
          body_en: row.body_en ?? "",
          body_nb: row.body_nb ?? "",
          title_en: row.title_en ?? "",
          title_nb: row.title_nb,
        })),
        spot,
      };
    }
    const nb = resolveDefaultItems(spot, no as Record<string, unknown>);
    const english = resolveDefaultItems(spot, en as Record<string, unknown>);
    return {
      hasRows: false,
      items: nb.map((item, index) => ({
        body_en: english[index]?.body ?? "",
        body_nb: item.body ?? "",
        title_en: english[index]?.title ?? "",
        title_nb: item.title,
      })),
      spot,
    };
  });
}

const isOptionalString = (value: unknown): boolean =>
  value === undefined || value === null || typeof value === "string";

const isValidShape = (items: unknown): items is MembershipSpotInputItem[] =>
  Array.isArray(items) &&
  items.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).title_nb === "string" &&
      isOptionalString((item as Record<string, unknown>).title_en) &&
      isOptionalString((item as Record<string, unknown>).body_nb) &&
      isOptionalString((item as Record<string, unknown>).body_en)
  );

const validate = (items: unknown, hasBody: boolean): string | null => {
  if (!isValidShape(items)) {
    return TEXT_ERRORS.titleMissing;
  }
  if (items.length === 0) {
    return TEXT_ERRORS.noItems;
  }
  if (items.length > MEMBERSHIP_TEXT_MAX_ITEMS) {
    return TEXT_ERRORS.tooMany;
  }
  for (const item of items) {
    const title = trimmed(item.title_nb);
    if (!title) {
      return TEXT_ERRORS.titleMissing;
    }
    if (
      title.length > MEMBERSHIP_TEXT_TITLE_MAX ||
      trimmed(item.title_en).length > MEMBERSHIP_TEXT_TITLE_MAX
    ) {
      return TEXT_ERRORS.titleTooLong;
    }
    const bodyTooLong =
      hasBody &&
      (trimmed(item.body_nb).length > MEMBERSHIP_TEXT_BODY_MAX ||
        trimmed(item.body_en).length > MEMBERSHIP_TEXT_BODY_MAX);
    if (bodyTooLong) {
      return TEXT_ERRORS.bodyTooLong;
    }
  }
  return null;
};

interface Draft {
  body_en: string;
  body_nb: string;
  title_en: string;
  title_nb: string;
}

/** Fills blank English in one translation call; Norwegian is the fallback. */
const fillEnglish = async (
  drafts: Draft[],
  hasBody: boolean
): Promise<void> => {
  const fields: { format: "plain"; key: string; value: string }[] = [];
  drafts.forEach((draft, index) => {
    if (!draft.title_en) {
      fields.push({
        format: "plain",
        key: `title_${index}`,
        value: draft.title_nb,
      });
    }
    if (hasBody && draft.body_nb && !draft.body_en) {
      fields.push({
        format: "plain",
        key: `body_${index}`,
        value: draft.body_nb,
      });
    }
  });
  if (fields.length === 0) {
    return;
  }
  let translated: Record<string, string> = {};
  try {
    translated = await translateContentFields({
      contentType: "membership_text",
      fields,
      sourceLocale: "no",
      targetLocale: "en",
    });
  } catch {
    translated = {};
  }
  for (const field of fields) {
    const index = Number(field.key.split("_")[1]);
    const draft = drafts[index];
    if (!draft) {
      continue;
    }
    const isTitle = field.key.startsWith("title_");
    const limit = isTitle
      ? MEMBERSHIP_TEXT_TITLE_MAX
      : MEMBERSHIP_TEXT_BODY_MAX;
    const candidate = trimmed(translated[field.key]);
    const value =
      candidate && candidate.length <= limit ? candidate : field.value;
    if (isTitle) {
      draft.title_en = value;
    } else {
      draft.body_en = value;
    }
  }
};

const afterWrite = async (): Promise<void> => {
  await notifyWebsite(["membership-texts"]);
  revalidatePath(TEXTS_PATH);
};

export async function saveMembershipSpot(
  spot: MembershipTextSpot,
  items: MembershipSpotInputItem[]
): Promise<ActionResult> {
  const ctx = await requireTextEditor();
  if (!ctx) {
    return { error: UNAUTHORIZED };
  }
  if (!isSpot(spot)) {
    return { error: TEXT_ERRORS.unknownSpot };
  }
  const { hasBody } = MEMBERSHIP_TEXT_SPOT_META[spot];
  const invalid = validate(items, hasBody);
  if (invalid) {
    return { error: invalid };
  }

  const drafts: Draft[] = items.map((item) => ({
    body_en: hasBody ? trimmed(item.body_en) : "",
    body_nb: hasBody ? trimmed(item.body_nb) : "",
    title_en: trimmed(item.title_en),
    title_nb: trimmed(item.title_nb),
  }));
  await fillEnglish(drafts, hasBody);

  let wrote = false;
  try {
    const { db } = await createAdminClient();
    const keep = new Set<string>();
    for (const [index, draft] of drafts.entries()) {
      const id = membershipTextRowId(spot, index);
      keep.add(id);
      wrote = true;
      await db.upsertRow("app", TABLE, id, {
        body_en: hasBody && draft.body_en ? draft.body_en : null,
        body_nb: hasBody && draft.body_nb ? draft.body_nb : null,
        sort_order: index,
        spot,
        title_en: draft.title_en,
        title_nb: draft.title_nb,
      });
    }
    const existing = await listSpotRows(db, spot);
    for (const row of existing) {
      if (!keep.has(row.$id)) {
        await db.deleteRow("app", TABLE, row.$id);
      }
    }
  } catch {
    if (wrote) {
      await afterWrite();
    }
    return { error: TEXT_ERRORS.saveFailed };
  }

  await logAuditEvent(ctx, "membership_texts_saved", {
    payload: { count: drafts.length, spot },
    resourceId: spot,
    resourceType: "membership_texts",
  });
  await afterWrite();
  return { data: true };
}

export async function resetMembershipSpot(
  spot: MembershipTextSpot
): Promise<ActionResult> {
  const ctx = await requireTextEditor();
  if (!ctx) {
    return { error: UNAUTHORIZED };
  }
  if (!isSpot(spot)) {
    return { error: TEXT_ERRORS.unknownSpot };
  }
  let wrote = false;
  try {
    const { db } = await createAdminClient();
    const existing = await listSpotRows(db, spot);
    for (const row of existing) {
      wrote = true;
      await db.deleteRow("app", TABLE, row.$id);
    }
  } catch {
    if (wrote) {
      await afterWrite();
    }
    return { error: TEXT_ERRORS.resetFailed };
  }
  await logAuditEvent(ctx, "membership_texts_reset", {
    resourceId: spot,
    resourceType: "membership_texts",
  });
  await afterWrite();
  return { data: true };
}
