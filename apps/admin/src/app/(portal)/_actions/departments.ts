"use server";

import { AppwriteException, Query } from "@repo/api";
import { type PageDoc, savePageDraft } from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Departments, Pages } from "@repo/api/types/appwrite";
import { unitPageSlug } from "@repo/shared/utils/unit-urls";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { canManageDepartment } from "@/lib/departments";
import { logAuditEvent } from "./audit-log";

export async function listDepartments(opts?: {
  campusId?: string;
  ids?: string[];
  includeInactive?: boolean;
  search?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [Query.orderAsc("Name"), Query.limit(200)];

  // Explicit id scoping for department users. The departments table is
  // read("any"), so this filter IS the authorization boundary — it cannot be
  // left to row security.
  if (opts?.ids) {
    if (opts.ids.length === 0) {
      return [];
    }
    queries.push(Query.equal("$id", opts.ids));
  }

  // The SOAP sync persists inactive 24SO units (active === false). By default
  // keep them out of generic pickers (e.g. the page editor); the departments
  // management view opts in via includeInactive to show/flag them. Apply the
  // filter in the QUERY (before the 200-row cap) so inactive rows can't displace
  // valid active departments off the first page. active is nullable, so legacy
  // rows with no value (null) are treated as active.
  if (!opts?.includeInactive) {
    queries.push(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
  }

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  } else if (ctx.activeCampusId) {
    // Global admin scoped to a campus via the switcher.
    queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  if (opts?.search) {
    queries.push(Query.search("Name", opts.search));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );
  return response.rows;
}

async function _getDepartment(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

const DEFAULT_ACCENT = "#3DA9E0";

export async function getDepartmentWithPage(
  id: string
): Promise<{ department: Departments; page: Pages | null } | null> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const found = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const department = found.rows[0];
  if (!(department && canManageDepartment(ctx, department))) {
    return null;
  }

  const slug = unitPageSlug({
    campusId: department.campus_id,
    slug: department.slug,
  });
  if (!slug) {
    return { department, page: null };
  }

  // Admin client: the page row carries no permissions until published, so a
  // session-scoped read would not see a department's own draft.
  //
  // Select only what UnitPageCard reads — page_translations rows carry
  // puck_document/draft_document (string(50000) each), so `translation_refs.*`
  // would ship up to ~200KB of draft JSON into the RSC payload for a card that
  // never renders it. The two named relationship columns are what the card's
  // per-locale row needs: publishing is per-locale, and pages.status flips to
  // "published" as soon as ANY locale is, so the page-level flag alone would
  // tell a board that published only Norwegian that both locales are live.
  const { db: adminDb } = await createAdminClient();
  const pages = await adminDb.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    Query.select([
      "$id",
      "status",
      "translation_refs.locale",
      "translation_refs.is_published",
    ]),
    Query.limit(1),
  ]);

  return { department, page: pages.rows[0] ?? null };
}

export async function createUnitPage(
  id: string
): Promise<{ pageId: string } | { error: string }> {
  const ctx = await requireAuth();
  try {
    const { db } = await createAdminClient();
    const found = await db.listRows<Departments>("app", "departments", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const department = found.rows[0];
    if (!(department && canManageDepartment(ctx, department))) {
      return { error: "You do not have access to this department" };
    }

    const slug = unitPageSlug({
      campusId: department.campus_id,
      slug: department.slug,
    });
    if (!slug) {
      return {
        error:
          "This department has no slug yet. Run the department sync, then try again.",
      };
    }

    // Idempotent by design. resolveUniquePageSlug silently appends -2 when a
    // NEW page's slug collides, and a unit page at ".../fadderullan-2" is
    // permanently unreachable — the web routes only look up the unsuffixed
    // slug. Reusing an existing row closes that hole.
    const existing = await db.listRows<Pages>("app", "pages", [
      Query.equal("slug", slug),
      Query.select(["$id", "department_id"]),
      Query.limit(1),
    ]);
    const already = existing.rows[0];
    if (already) {
      // Only hand back a page that genuinely belongs to THIS department.
      // Anything else at this slug is a squatter (savePageEditorDoc now
      // refuses to create one, but rows predating that guard can exist), and
      // returning it would drop this board straight into another
      // department's editor.
      if (already.department_id !== department.$id) {
        return {
          error:
            "Another department already owns a page at this address. Contact BISO IT to sort it out.",
        };
      }
      return { pageId: already.$id };
    }

    const doc: PageDoc = {
      blocks: [],
      meta: {
        accentColor: DEFAULT_ACCENT,
        department: department.$id,
        description: "",
        slug,
        status: "draft",
        title: department.Name,
      },
    };

    // Left to itself, savePageDraft attributes the page to the AUTHOR's
    // campus, which is null for a global admin with no campus filter.
    // hasRowAccess then denies the owning campus's admins
    // (authorization.ts:183-185) and applyScopeQueries drops it from their
    // listing. A unit page belongs to its department's campus, not the
    // author's, so pass it explicitly rather than relying on the
    // author-derived default.
    //
    // slugConflict: "fail" — the preflight lookup above is a fast path, not a
    // lock: two concurrent creates for the same department can both pass it
    // and both reach here. savePageDraft's default suffixing behavior would
    // let the loser silently mint "<slug>-2", which is permanently
    // unreachable (both public routes and this card only ever look up the
    // unsuffixed slug). The `pages` table's UNIQUE index on `slug`
    // (`page_slug_unique`) is the only thing that can actually arbitrate a
    // race, so skip the suffix probe and let the write hit that index — a
    // collision surfaces as a 409, recovered just below.
    let pageId: string;
    try {
      ({ pageId } = await savePageDraft({
        id: null,
        doc,
        locale: "no",
        ctx,
        campusId: department.campus_id,
        slugConflict: "fail",
      }));
    } catch (writeError) {
      if (
        !(writeError instanceof AppwriteException && writeError.code === 409)
      ) {
        throw writeError;
      }
      // Lost the race: another request created a page at this slug between
      // our preflight and this write. Re-run the exact same ownership check
      // the preflight above does, against whatever now exists at the slug.
      const race = await db.listRows<Pages>("app", "pages", [
        Query.equal("slug", slug),
        Query.select(["$id", "department_id"]),
        Query.limit(1),
      ]);
      const raceWinner = race.rows[0];
      if (!raceWinner) {
        // The unique index rejected the write but nothing is there now
        // (e.g. the winner's row was since deleted) — propagate rather than
        // guess.
        throw writeError;
      }
      if (raceWinner.department_id !== department.$id) {
        return {
          error:
            "Another department already owns a page at this address. Contact BISO IT to sort it out.",
        };
      }
      pageId = raceWinner.$id;
    }

    await logAuditEvent(ctx, "unit_page_created", {
      resourceId: pageId,
      resourceType: "page",
    });
    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { pageId };
  } catch (e) {
    console.error("[createUnitPage]", e);
    return { error: e instanceof Error ? e.message : "Could not create page" };
  }
}
