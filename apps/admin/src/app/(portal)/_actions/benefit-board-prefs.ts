"use server";

import { cookies } from "next/headers";
import {
  BENEFIT_BOARD_CAMPUS_COOKIE,
  isBoardCampusId,
} from "@/lib/benefits/board-campus";
import { isProd } from "@/lib/utils";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Remembers the benefits board tab so the next visit opens on the same
 * campus. It only stores a known campus id on the caller's own browser and
 * reads no data, so it needs no session; the board still checks access.
 */
export async function rememberBenefitBoardCampus(
  campusId: string
): Promise<void> {
  if (!isBoardCampusId(campusId)) {
    return;
  }
  const store = await cookies();
  store.set(BENEFIT_BOARD_CAMPUS_COOKIE, campusId, {
    httpOnly: true,
    maxAge: ONE_YEAR_SECONDS,
    path: "/benefits",
    sameSite: "lax",
    secure: isProd,
  });
}
