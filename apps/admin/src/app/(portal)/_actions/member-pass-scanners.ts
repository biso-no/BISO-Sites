"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { isSmtpConfigured, sendEmail } from "@repo/connectors/email";
import {
  createGrant,
  findActiveGrantForUserAndCampus,
  type GrantStatus,
  getGrant,
  grantStatus,
  isGrantActive,
  listGrants,
  revokeGrant,
  type ScannerGrantRow,
  updateGrant,
} from "@repo/shared/member-pass/scanner-grants";
import { buildScannerInviteEmail } from "@repo/shared/member-pass/scanner-invite-email";
import { requireNavAccess, type UserAuthContext } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { ROLES } from "@/lib/roles";
import { logAuditEvent } from "./audit-log";

type ActionResult<T> =
  | { data: T; success: true }
  | { error: string; success: false };

export interface ScannerGrantView {
  campusId: string | null;
  createdAt: string;
  email: string;
  expiresAt: string | null;
  /** Name of the admin who granted access, or their user id if unknown. */
  grantedBy: string;
  id: string;
  invitedAt: string | null;
  name: string | null;
  revokedAt: string | null;
  status: GrantStatus;
}

export interface ScannerInviteResult {
  emailSent: boolean;
  grant: ScannerGrantView;
}

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type AdminUsers = AdminClient["users"];

const NAV_KEY = "portal.members";
const RESOURCE_TYPE = "member_pass_scanner";
const MAX_EMAIL_LENGTH = 320;
/** Matches the `member_pass_scanners.name` column size. */
const MAX_NAME_LENGTH = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.biso.no";

const fail = (error: string) => ({ error, success: false }) as const;

function isGlobalAdmin(ctx: UserAuthContext): boolean {
  return ctx.roles.includes(ROLES.GLOBAL_ADMIN);
}

/** Campus-less grants ("all campuses") are for global admins only. */
function mayManageCampus(
  ctx: UserAuthContext,
  campusId: string | null
): boolean {
  if (isGlobalAdmin(ctx)) {
    return true;
  }
  return campusId !== null && ctx.managedCampusIds.includes(campusId);
}

function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return null;
  }
  return email;
}

/** undefined = longer than the column allows; null = no name given. */
function normaliseName(
  raw: string | null | undefined
): string | null | undefined {
  const name = raw?.trim();
  if (!name) {
    return null;
  }
  return name.length > MAX_NAME_LENGTH ? undefined : name;
}

/** undefined = invalid or not in the future; null = no end date. */
function parseExpiry(raw: string | null, now: Date): Date | null | undefined {
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date <= now) {
    return undefined;
  }
  return date;
}

async function resolveNames(
  users: AdminUsers,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const entries = await Promise.all(
    unique.map(async (userId) => {
      const user = await users.get({ userId }).catch(() => null);
      return [userId, user?.name || user?.email || userId] as const;
    })
  );
  return new Map(entries);
}

async function toViews(
  users: AdminUsers,
  rows: ScannerGrantRow[],
  now: Date
): Promise<ScannerGrantView[]> {
  const names = await resolveNames(
    users,
    rows.map((row) => row.granted_by)
  );
  return rows.map((row) => ({
    campusId: row.campus_id,
    createdAt: row.$createdAt,
    email: row.email,
    expiresAt: row.expires_at,
    grantedBy: names.get(row.granted_by) ?? row.granted_by,
    id: row.$id,
    invitedAt: row.invited_at,
    name: row.name,
    revokedAt: row.revoked_at,
    status: grantStatus(row, now),
  }));
}

async function toView(
  users: AdminUsers,
  row: ScannerGrantRow,
  now: Date
): Promise<ScannerGrantView> {
  const [view] = await toViews(users, [row], now);
  if (!view) {
    throw new Error("Grant view could not be built");
  }
  return view;
}

/**
 * Sends the invitation. Never throws: an unconfigured relay or a send error
 * returns false so the saved grant is kept and the page can say so.
 */
async function sendInvite(
  ctx: UserAuthContext,
  grant: ScannerGrantRow
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    return false;
  }
  const email = buildScannerInviteEmail({
    androidUrl: process.env.BISO_APP_ANDROID_URL?.trim() || DEFAULT_ANDROID_URL,
    campusName: grant.campus_id
      ? (CAMPUS_ID_TO_NAME[grant.campus_id] ?? grant.campus_id)
      : null,
    email: grant.email,
    expiresAt: grant.expires_at ? new Date(grant.expires_at) : null,
    inviterName: ctx.name || ctx.email || "BISO",
    iosUrl: process.env.BISO_APP_IOS_URL?.trim() || null,
  });
  try {
    await sendEmail({ ...email, to: grant.email });
    return true;
  } catch (error) {
    console.error("[Member Pass] Sending a scanner invitation failed:", error);
    return false;
  }
}

async function findOrCreateUser(
  users: AdminUsers,
  email: string,
  name: string | null
): Promise<string> {
  const found = await users.list({
    queries: [Query.equal("email", email), Query.limit(1)],
  });
  const existing = found.users[0];
  if (existing) {
    return existing.$id;
  }
  const created = await users.create({
    email,
    name: name ?? undefined,
    userId: ID.unique(),
  });
  return created.$id;
}

/** Stamps invited_at after a sent email and returns the row as stored. */
async function markInvited(
  db: AdminClient["db"],
  grant: ScannerGrantRow,
  now: Date
): Promise<ScannerGrantRow> {
  const invitedAt = now.toISOString();
  await updateGrant(db, grant.$id, { invited_at: invitedAt });
  return { ...grant, invited_at: invitedAt };
}

export async function listScannerGrants(): Promise<
  ActionResult<ScannerGrantView[]>
> {
  const ctx = await requireNavAccess(NAV_KEY);
  const campusIds = isGlobalAdmin(ctx) ? null : ctx.managedCampusIds;
  if (campusIds?.length === 0) {
    return { data: [], success: true };
  }
  try {
    const { db, users } = await createAdminClient();
    const rows = await listGrants(db, campusIds);
    return { data: await toViews(users, rows, new Date()), success: true };
  } catch (error) {
    console.error("[Member Pass] Listing scanner grants failed:", error);
    return fail("failed");
  }
}

export async function inviteScanner(input: {
  campusId: string | null;
  email: string;
  expiresAt: string | null;
  name: string | null;
}): Promise<ActionResult<ScannerInviteResult>> {
  const ctx = await requireNavAccess(NAV_KEY);
  const email = normaliseEmail(input.email);
  if (!email) {
    return fail("invalid_email");
  }
  const campusId = input.campusId || null;
  if (!mayManageCampus(ctx, campusId)) {
    return fail("forbidden_campus");
  }
  const now = new Date();
  const expiresAt = parseExpiry(input.expiresAt, now);
  if (expiresAt === undefined) {
    return fail("invalid_expiry");
  }
  const name = normaliseName(input.name);
  if (name === undefined) {
    return fail("invalid_name");
  }

  try {
    const { db, users } = await createAdminClient();
    const userId = await findOrCreateUser(users, email, name);
    const existing = await findActiveGrantForUserAndCampus(
      db,
      userId,
      campusId,
      now
    );

    let grant: ScannerGrantRow;
    if (existing) {
      // No end date given on a re-invite keeps the existing one; there is no
      // way to clear an end date here — revoke and add the person again.
      const patch = {
        expires_at: expiresAt ? expiresAt.toISOString() : existing.expires_at,
        name: name ?? existing.name,
      };
      await updateGrant(db, existing.$id, patch);
      grant = { ...existing, ...patch };
    } else {
      grant = await createGrant(db, {
        campusId,
        email,
        expiresAt,
        grantedBy: ctx.userId,
        name,
        userId,
      });
    }

    const emailSent = await sendInvite(ctx, grant);
    if (emailSent) {
      grant = await markInvited(db, grant, now);
    }

    await logAuditEvent(ctx, "member_pass_scanner.invite", {
      payload: {
        campus_id: campusId,
        email,
        email_sent: emailSent,
        expires_at: grant.expires_at,
        updated: Boolean(existing),
      },
      resourceId: grant.$id,
      resourceType: RESOURCE_TYPE,
    });
    return {
      data: { emailSent, grant: await toView(users, grant, now) },
      success: true,
    };
  } catch (error) {
    console.error("[Member Pass] Inviting a scanner failed:", error);
    return fail("failed");
  }
}

export async function resendScannerInvite(
  grantId: string
): Promise<ActionResult<ScannerInviteResult>> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db, users } = await createAdminClient();
    const found = await getGrant(db, grantId);
    if (!found) {
      return fail("not_found");
    }
    if (!mayManageCampus(ctx, found.campus_id)) {
      return fail("forbidden_campus");
    }
    const now = new Date();
    if (!isGrantActive(found, now)) {
      return fail("not_active");
    }

    const emailSent = await sendInvite(ctx, found);
    const grant = emailSent ? await markInvited(db, found, now) : found;

    await logAuditEvent(ctx, "member_pass_scanner.resend", {
      payload: { campus_id: grant.campus_id, email_sent: emailSent },
      resourceId: grant.$id,
      resourceType: RESOURCE_TYPE,
    });
    return {
      data: { emailSent, grant: await toView(users, grant, now) },
      success: true,
    };
  } catch (error) {
    console.error(
      "[Member Pass] Resending a scanner invitation failed:",
      error
    );
    return fail("failed");
  }
}

export async function revokeScannerGrant(
  grantId: string
): Promise<ActionResult<ScannerGrantView>> {
  const ctx = await requireNavAccess(NAV_KEY);
  try {
    const { db, users } = await createAdminClient();
    const found = await getGrant(db, grantId);
    if (!found) {
      return fail("not_found");
    }
    if (!mayManageCampus(ctx, found.campus_id)) {
      return fail("forbidden_campus");
    }
    const now = new Date();
    // Revoking twice keeps the original revocation time.
    const grant = found.revoked_at
      ? found
      : { ...found, revoked_at: now.toISOString() };
    if (!found.revoked_at) {
      await revokeGrant(db, found.$id, now);
      await logAuditEvent(ctx, "member_pass_scanner.revoke", {
        payload: { campus_id: found.campus_id, email: found.email },
        resourceId: found.$id,
        resourceType: RESOURCE_TYPE,
      });
    }
    return { data: await toView(users, grant, now), success: true };
  } catch (error) {
    console.error("[Member Pass] Revoking a scanner grant failed:", error);
    return fail("failed");
  }
}
