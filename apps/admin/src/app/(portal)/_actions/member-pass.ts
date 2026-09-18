"use server";

import { createAdminClient } from "@repo/api/server";
import {
  generateGuestToken,
  hashGuestToken,
  resolveLinkExpiry,
} from "@repo/shared/member-pass/guest-links";
import {
  createLinkRow,
  getLinkRow,
  listLiveLinks,
  revokeLinkRow,
} from "@repo/shared/member-pass/scan-store";
import type {
  ScannerLinkRow,
  ScanOutcome,
} from "@repo/shared/member-pass/scan-types";
import { scanLogFor, verifyScan } from "@repo/shared/member-pass/verify-scan";
import {
  type DayColor,
  dayColor,
  readMemberPassSecret,
} from "@repo/shared/utils/member-pass";
import { headers } from "next/headers";
import { requireNavAccess, type UserAuthContext } from "@/lib/authorization";
import { getScanMembershipStatus } from "@/lib/member-pass/membership-lookup";
import { ROLES } from "@/lib/roles";

type ActionResult<T> =
  | { data: T; success: true }
  | { error: string; success: false };

export interface ScannerLinkView {
  campusId: string | null;
  expiresAt: string;
  id: string;
  label: string;
}

const NAV_KEY = "portal.members";
const MAX_LABEL_LENGTH = 120;

const fail = (error: string) => ({ error, success: false }) as const;

function isGlobalAdmin(ctx: UserAuthContext): boolean {
  return ctx.roles.includes(ROLES.GLOBAL_ADMIN);
}

function mayManageCampus(
  ctx: UserAuthContext,
  campusId: string | null
): boolean {
  if (isGlobalAdmin(ctx)) {
    return true;
  }
  return campusId !== null && ctx.managedCampusIds.includes(campusId);
}

function toView(row: ScannerLinkRow): ScannerLinkView {
  return {
    campusId: row.campus_id,
    expiresAt: row.expires_at,
    id: row.$id,
    label: row.label,
  };
}

async function originFromRequest(): Promise<string> {
  const list = await headers();
  const host =
    list.get("x-forwarded-host") ?? list.get("host") ?? "admin.biso.no";
  const proto = list.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function getScannerDayColor(): Promise<ActionResult<DayColor>> {
  await requireNavAccess(NAV_KEY);
  const secret = readMemberPassSecret();
  if (!secret) {
    return fail("not_configured");
  }
  return { data: dayColor(new Date(), secret), success: true };
}

export async function scanMemberPass(
  code: string
): Promise<ActionResult<ScanOutcome>> {
  const ctx = await requireNavAccess(NAV_KEY);
  const secret = readMemberPassSecret();
  if (!secret) {
    return fail("not_configured");
  }
  try {
    const { db } = await createAdminClient();
    const outcome = await verifyScan(
      code.trim(),
      { kind: "staff", userId: ctx.userId },
      {
        db,
        getStatus: getScanMembershipStatus,
        now: new Date(),
        scans: scanLogFor(db),
        secret,
      }
    );
    return { data: outcome, success: true };
  } catch (error) {
    console.error("[Member Pass] Staff scan failed:", error);
    return fail("failed");
  }
}

export async function listScannerLinks(): Promise<
  ActionResult<ScannerLinkView[]>
> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db } = await createAdminClient();
    const rows = await listLiveLinks(
      db,
      new Date(),
      isGlobalAdmin(ctx) ? null : ctx.managedCampusIds
    );
    return { data: rows.map(toView), success: true };
  } catch (error) {
    console.error("[Member Pass] Listing scanner links failed:", error);
    return fail("failed");
  }
}

export async function createScannerLink(input: {
  campusId: string | null;
  expiresAt: string | null;
  label: string;
}): Promise<ActionResult<{ link: ScannerLinkView; url: string }>> {
  const ctx = await requireNavAccess(NAV_KEY);
  const label = input.label.trim();
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return fail("invalid_label");
  }
  if (!mayManageCampus(ctx, input.campusId)) {
    return fail("forbidden_campus");
  }
  const now = new Date();
  const expiresAt = resolveLinkExpiry(
    input.expiresAt ? new Date(input.expiresAt) : null,
    now
  );
  if (!expiresAt) {
    return fail("invalid_expiry");
  }

  try {
    const token = generateGuestToken();
    const { db } = await createAdminClient();
    const row = await createLinkRow(db, {
      campusId: input.campusId,
      createdBy: ctx.userId,
      expiresAt,
      label,
      tokenHash: hashGuestToken(token),
    });
    return {
      data: {
        link: toView(row),
        url: `${await originFromRequest()}/scan/${token}`,
      },
      success: true,
    };
  } catch (error) {
    console.error("[Member Pass] Creating a scanner link failed:", error);
    return fail("failed");
  }
}

export async function revokeScannerLink(
  linkId: string
): Promise<ActionResult<null>> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db } = await createAdminClient();
    const link = await getLinkRow(db, linkId);
    if (!link) {
      return fail("not_found");
    }
    if (!mayManageCampus(ctx, link.campus_id)) {
      return fail("forbidden_campus");
    }
    await revokeLinkRow(db, linkId, new Date());
    return { data: null, success: true };
  } catch (error) {
    console.error("[Member Pass] Revoking a scanner link failed:", error);
    return fail("failed");
  }
}
