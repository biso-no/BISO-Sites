"use server";

import { AppwriteException, ID, Query } from "@repo/api";
import { type PageDoc, savePageDraft } from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Departments,
  Pages,
} from "@repo/api/types/appwrite";
import {
  assertStorableUnitCategory,
  parseUnitCategory,
  UNIT_CATEGORIES,
} from "@repo/shared/utils/unit-categories";
import { unitPageSlug } from "@repo/shared/utils/unit-urls";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { canManageDepartment } from "@/lib/departments";
import {
  emptyResult,
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";
import { buildContentTranslationPermissions } from "@/lib/utils";
import { logAuditEvent } from "./audit-log";

interface DepartmentScope {
  campusId?: string;
  ids?: string[];
  includeInactive?: boolean;
}

type AuthContext = Awaited<ReturnType<typeof requireAuth>>;

/**
 * The scope filters `listDepartments` and `countDepartmentTriage` MUST agree
 * on. The triage chips describe the same set the list pages through, so any
 * divergence here would make a chip advertise rows the list can never reach.
 *
 * Returns `null` when the scope is provably empty, so the caller can answer
 * without a round trip.
 */
function departmentScopeQueries(
  ctx: AuthContext,
  scope: DepartmentScope
): string[] | null {
  const queries: string[] = [];

  // Explicit id scoping for department users. The departments table is
  // read("any"), so this filter IS the authorization boundary — it cannot be
  // left to row security.
  if (scope.ids) {
    if (scope.ids.length === 0) {
      return null;
    }
    queries.push(Query.equal("$id", scope.ids));
  }

  // The SOAP sync persists inactive 24SO units (active === false). By default
  // keep them out of generic pickers (e.g. the page editor); the departments
  // management view opts in via includeInactive to show/flag them. Apply the
  // filter in the QUERY (before pagination) so inactive rows can't displace
  // valid active departments off the visible page. active is nullable, so
  // legacy rows with no value (null) are treated as active.
  if (!scope.includeInactive) {
    queries.push(
      Query.or([Query.equal("active", true), Query.isNull("active")])
    );
  }

  if (scope.campusId) {
    queries.push(Query.equal("campus_id", scope.campusId));
  } else if (ctx.activeCampusId && ctx.roles.includes("globaladmin")) {
    // Global admin scoped to a campus via the switcher. Deliberately gated to
    // globaladmin: the admin_campus_ctx cookie is readable (and, via
    // setCampusFilter, writable) by any role, so a non-global-admin's listing
    // must stay scoped by their managed campuses regardless of its value —
    // otherwise a campus admin could point the cookie at a campus they don't
    // manage and see its departments, whose cards then 404 at
    // getDepartmentWithPage's own canManageDepartment check. Matches
    // resolvePageCampusId in packages/api/page-builder.ts, which reads
    // activeCampusId only for global admins.
    queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  return queries;
}

export async function listDepartments(
  params: ListParams & {
    campusId?: string;
    ids?: string[];
    includeInactive?: boolean;
    /** A UnitCategory value, or one of the triage pseudo-filters. */
    type?: string;
  }
): Promise<PaginatedResult<Departments>> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scope = departmentScopeQueries(ctx, params);
  if (scope === null) {
    return emptyResult<Departments>(params);
  }

  const queries: string[] = [
    Query.orderAsc("Name"),
    ...paginationQueries(params),
    ...scope,
  ];

  // The triage filters used to run in JS over a full 500-row load. They are
  // all expressible as queries, so they now run BEFORE pagination — otherwise
  // a filtered page would only ever show whichever matches happened to land in
  // the current slice.
  if (params.type === "uncategorised") {
    queries.push(Query.isNull("type"));
  } else if (params.type === "missing_logo") {
    queries.push(Query.or([Query.equal("logo", ""), Query.isNull("logo")]));
  } else if (params.type) {
    queries.push(Query.equal("type", params.type));
  }

  // `departments` carries a fulltext index (`search`) covering Name.
  if (params.q) {
    queries.push(Query.contains("Name", params.q));
  }

  const response = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

/**
 * Full active-department list for pickers (the page editor's department
 * dropdown). Deliberately separate from listDepartments: a picker needs every
 * row, not a page, and must not be constrained by PageSize — there are ~240
 * departments today, so paging one of these dropdowns would silently hide most
 * of them.
 */
export async function listAllDepartments(): Promise<Departments[]> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scope = departmentScopeQueries(ctx, {});
  const response = await db.listRows<Departments>("app", "departments", [
    Query.orderAsc("Name"),
    Query.limit(500),
    ...(scope ?? []),
  ]);

  return response.rows;
}

/**
 * Triage chip counts across the FULL scoped set. The list itself is paginated,
 * so the counts cannot be derived from the visible rows — they would report
 * one page's worth and change as the user paged. This deliberately takes no
 * page/size and issues no offset: it projects only $id/type/logo, which keeps
 * a 500-row read cheap enough to run alongside the page query.
 */
export async function countDepartmentTriage(opts: {
  campusId?: string;
  ids?: string[];
  includeInactive?: boolean;
}): Promise<Record<string, number>> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const counts: Record<string, number> = {
    all: 0,
    missing_logo: 0,
    uncategorised: 0,
  };
  for (const category of UNIT_CATEGORIES) {
    counts[category] = 0;
  }

  const scope = departmentScopeQueries(ctx, opts);
  if (scope === null) {
    return counts;
  }

  const response = await db.listRows<Departments>("app", "departments", [
    Query.select(["$id", "type", "logo"]),
    Query.limit(500),
    ...scope,
  ]);

  counts.all = response.rows.length;
  for (const department of response.rows) {
    const key = parseUnitCategory(department.type) ?? "uncategorised";
    counts[key] = (counts[key] ?? 0) + 1;
    if (!department.logo?.trim()) {
      counts.missing_logo += 1;
    }
  }

  return counts;
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

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** The two locales the public site renders a unit in. */
const DEPARTMENT_LOCALES = ["no", "en"] as const;

/**
 * `departments.logo` is `string(100)` in Appwrite and the schema is
 * auto-generated, so it cannot be widened here. A full storage view URL
 * (`<endpoint>/storage/buckets/media/files/<id>/view?project=<project>`) is
 * ~94 characters with a 20-char `ID.unique()` and blows past 100 as soon as
 * the endpoint, the bucket, or a custom 36-char file id grows — Appwrite then
 * rejects the whole write. So the column stores the BARE Appwrite file id and
 * every render site expands it with `resolveStorageFileUrl` from
 * `@repo/api/storage`, which is exactly the mixed "file id or URL" shape that
 * helper already exists for (webshop products store it the same way). A
 * hand-pasted external URL is still accepted as long as it fits.
 */
const LOGO_MAX_LENGTH = 100;

/** `content_translations` column sizes — see packages/api/appwrite.config.json. */
const TRANSLATION_TITLE_MAX = 500;
const TRANSLATION_SHORT_DESCRIPTION_MAX = 500;
const TRANSLATION_DESCRIPTION_MAX = 8000;

const departmentTranslationSchema = z.object({
  description: z.string().max(TRANSLATION_DESCRIPTION_MAX).default(""),
  short_description: z
    .string()
    .max(TRANSLATION_SHORT_DESCRIPTION_MAX)
    .default(""),
  title: z.string().max(TRANSLATION_TITLE_MAX).default(""),
});

const departmentProfileSchema = z
  .object({
    hero: z.string().trim().nullable().default(null),
    logo: z.string().trim().max(LOGO_MAX_LENGTH).nullable().default(null),
    translations: z.object({
      en: departmentTranslationSchema,
      no: departmentTranslationSchema,
    }),
    type: z.enum(UNIT_CATEGORIES).nullable().default(null),
  })
  .superRefine((values, context) => {
    for (const locale of DEPARTMENT_LOCALES) {
      const translation = values.translations[locale];
      // `content_translations.description` is a REQUIRED column, so a locale
      // row cannot exist on a teaser alone. Reject it here rather than letting
      // Appwrite bounce the write with an opaque 400.
      if (
        translation.short_description.trim() &&
        !translation.description.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: `Add a description for the ${locale === "no" ? "Norwegian" : "English"} teaser`,
          path: ["translations", locale, "description"],
        });
      }
    }
  });

export type DepartmentProfileInput = z.input<typeof departmentProfileSchema>;

/**
 * Existing locales are looked up by content metadata rather than the
 * `translations` relation: no admin code has ever written a department
 * translation, so any row that does exist predates the relationship backfill
 * and is unlinked. Matching on (content_type, content_id) both prevents a
 * duplicate locale row and re-links the orphan on the next save.
 */
async function loadDepartmentTranslations(
  db: AdminDb,
  departmentId: string
): Promise<ContentTranslations[]> {
  const response = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "department"),
      Query.equal("content_id", departmentId),
      Query.limit(10),
    ]
  );
  return response.rows;
}

async function syncDepartmentTranslations(
  db: AdminDb,
  department: Departments,
  input: z.output<typeof departmentProfileSchema>
): Promise<void> {
  const existing = await loadDepartmentTranslations(db, department.$id);
  // Keyed by plain string: `locale` is the generated `ContentTranslationsLocale`
  // enum, which the "no" | "en" literals below do not widen to.
  const byLocale = new Map<string, ContentTranslations>(
    existing.map((row) => [row.locale, row])
  );
  // Departments are a public surface (the table itself is read("any")), so the
  // translation rows carry the same public read. Going through the shared
  // builder keeps them consistent with every other content type.
  const permissions = buildContentTranslationPermissions({
    audience: "public",
    writeTeams: [],
  });

  for (const locale of DEPARTMENT_LOCALES) {
    const submitted = input.translations[locale];
    const current = byLocale.get(locale);
    const description = submitted.description.trim();
    const shortDescription = submitted.short_description.trim();

    if (!description) {
      // Cleared out. Leaving an empty row behind would keep the unit
      // advertising a blank description on the public site.
      if (current) {
        await db.deleteRow("app", "content_translations", current.$id);
      }
      continue;
    }

    const fields = {
      description,
      short_description: shortDescription || null,
      // `title` is a required column. Fall back to whatever is already stored,
      // then to the directory name, so an editor who only writes prose never
      // trips the constraint.
      title:
        submitted.title.trim() || current?.title?.trim() || department.Name,
    };

    if (current) {
      await db.updateRow(
        "app",
        "content_translations",
        current.$id,
        fields,
        permissions
      );
      continue;
    }

    await db.createRow(
      "app",
      "content_translations",
      ID.unique(),
      {
        ...fields,
        additional_fields: null,
        content_id: department.$id,
        content_type: "department",
        // A fresh row must arrive already related to its parent, otherwise it
        // is only reachable by the metadata lookup above.
        department_ref: department.$id,
        locale,
      },
      permissions
    );
  }
}

/**
 * Presentation metadata for a unit: its category, its imagery, and its
 * per-locale prose.
 *
 * Authorization is `canManageDepartment` — a global admin may edit any unit, a
 * campus admin only units whose `campus_id` is one they manage, and a plain
 * department member only the units they are actually a member of. The
 * `departments` table is `read("any")` with update granted solely to the
 * Operations Unit team, so a session-scoped write would fail for every campus
 * admin; the admin client is used instead and THIS CHECK is the authorization
 * boundary.
 */
export async function updateDepartment(
  id: string,
  values: DepartmentProfileInput
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAuth();

  const parsed = departmentProfileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "The unit details are not valid.",
    };
  }

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

    // `type` is free-text string(20), not a database enum — the assert helper
    // is the only thing standing between a future category and a rejected
    // write.
    const type = parsed.data.type
      ? assertStorableUnitCategory(parsed.data.type)
      : null;

    await db.updateRow("app", "departments", id, {
      hero: parsed.data.hero || null,
      logo: parsed.data.logo || null,
      type,
    });

    await syncDepartmentTranslations(db, department, parsed.data);

    await logAuditEvent(ctx, "department_updated", {
      payload: {
        hasHero: Boolean(parsed.data.hero),
        hasLogo: Boolean(parsed.data.logo),
        type,
      },
      resourceId: id,
      resourceType: "department",
    });

    revalidatePath("/departments");
    revalidatePath(`/departments/${id}`);
    return { success: true };
  } catch (e) {
    console.error("[updateDepartment]", e);
    return {
      error: e instanceof Error ? e.message : "Could not save the unit details",
    };
  }
}

export async function getDepartmentWithPage(id: string): Promise<{
  department: Departments;
  page: Pages | null;
  slugConflict: boolean;
  translations: ContentTranslations[];
} | null> {
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

  // Admin client throughout: content_translations rows are created with
  // read("any") only once they are meant to be public, and the profile editor
  // must see whatever is stored regardless.
  const { db: adminDb } = await createAdminClient();
  const translations = await loadDepartmentTranslations(adminDb, id);

  const slug = unitPageSlug({
    campusId: department.campus_id,
    slug: department.slug,
  });
  if (!slug) {
    return { department, page: null, slugConflict: false, translations };
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
  const pages = await adminDb.listRows<Pages>("app", "pages", [
    Query.equal("slug", slug),
    Query.select([
      "$id",
      "status",
      "department_id",
      "translation_refs.locale",
      "translation_refs.is_published",
    ]),
    Query.limit(1),
  ]);

  const foundPage = pages.rows[0];
  // A page can exist at this slug but belong to someone else (a legacy row,
  // or a squatter predating createUnitPage's own guard). A null
  // department_id means "no department", not "any department" — it must not
  // match either. Only hand back a page that is genuinely this department's;
  // otherwise report the conflict so the caller can tell "no page yet" apart
  // from "the address is taken" instead of offering a Create button that
  // createUnitPage will just reject.
  if (foundPage && foundPage.department_id !== department.$id) {
    return { department, page: null, slugConflict: true, translations };
  }

  return {
    department,
    page: foundPage ?? null,
    slugConflict: false,
    translations,
  };
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

    // The sync deliberately keeps an inactive department's slug (see
    // assignUnitSlugs in lib/departments.ts), so the slug check below would
    // happily pass here too. But both public lookups
    // (cachedDepartmentsBySlug, cachedDepartmentBySlugAndCampus in
    // apps/web/src/lib/data/public-content.ts) filter `Query.equal("active",
    // true)`, which EXCLUDES a null value. `active` is nullable, and unlike
    // listDepartments' own `Query.or([equal("active", true),
    // isNull("active")])` — which governs whether a row appears in the admin
    // management LISTING, a question null answers "yes" to — this check
    // answers "will this be reachable on the public site?", which null
    // answers "no" to. Treating null as active here would let a legacy
    // department with active: null get a page created, published, and
    // advertised as live that every public URL then 404s. Do not "fix" this
    // to match listDepartments; the two questions are different.
    if (department.active !== true) {
      return {
        error:
          "This department is inactive, so a page cannot be published for it.",
      };
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
