/**
 * Public membership text readers. `cachedMembershipTextRows` is the single
 * `"use cache"` entry (tag `membership-texts`) and THROWS on failure, so a
 * blip is never cached as an empty table. `getMembershipTextItems` is not
 * cached: it maps the cached rows per spot and returns null on any failure,
 * so call sites fall back to their i18n text without a catch of their own.
 */

import { type Models, Query } from "@repo/api";
import { createPublicClient } from "@repo/api/server";
import {
  type MembershipTextItem,
  type MembershipTextRowInput,
  type MembershipTextSpot,
  membershipTextItems,
} from "@repo/shared/utils/membership-texts";
import { cacheLife, cacheTag } from "next/cache";

// Well above the real count (7 spots x at most 12 items).
const MEMBERSHIP_TEXT_LIMIT = 200;

export async function cachedMembershipTextRows(): Promise<
  MembershipTextRowInput[]
> {
  "use cache";
  cacheLife("minutes");
  cacheTag("membership-texts");
  const { db } = await createPublicClient();
  const { rows } = await db.listRows<MembershipTextRowInput & Models.Row>(
    "app",
    "membership_texts",
    [
      Query.select([
        "spot",
        "sort_order",
        "title_nb",
        "title_en",
        "body_nb",
        "body_en",
      ]),
      Query.limit(MEMBERSHIP_TEXT_LIMIT),
    ]
  );
  return rows;
}

export async function getMembershipTextItems(
  spot: MembershipTextSpot,
  locale: "en" | "no"
): Promise<MembershipTextItem[] | null> {
  try {
    return membershipTextItems(await cachedMembershipTextRows(), spot, locale);
  } catch (error) {
    // Error type only: never row contents.
    console.error(
      "membership texts unavailable",
      error instanceof Error ? error.name : typeof error
    );
    return null;
  }
}
