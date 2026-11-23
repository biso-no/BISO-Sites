import { Query } from "@repo/api";
import type {
  Departments,
  Pages,
  PageTranslations,
} from "@repo/api/types/appwrite";
import { PagesStatus, PagesVisibility } from "@repo/api/types/appwrite";
import type { MapContext } from "@repo/shared/search/entries/common";
import {
  hasPublishedContent,
  type PageTranslationText,
  pageEntries,
  pageOwner,
} from "@repo/shared/search/entries/page";
import { unitEntries } from "@repo/shared/search/entries/unit";
import {
  isHubProject,
  nationalProjectForUnit,
  PROJECT_UNIT_SLUGS,
  type ProjectSlug,
  projectPageSlug,
} from "@repo/shared/utils/project-units";
import {
  campusSegmentToId,
  parseUnitSubPageSlug,
  unitPageSlug,
  unitSubPageSlug,
} from "@repo/shared/utils/unit-urls";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import type { SyncTarget } from "./resolve";
import {
  type AdminDb,
  columns,
  contentTranslations,
  DB,
  getRowOrNull,
  searchLocale,
} from "./rows";
import type { LoadedItem } from "./source";

const PAGE_TABLE = "pages";
const DEPARTMENT_TABLE = "departments";
const NATIONAL_CAMPUS_ID = "5";
const PROJECTS = Object.keys(PROJECT_UNIT_SLUGS) as ProjectSlug[];

/**
 * `getPage`'s projection (packages/api/page-builder.ts): the published
 * translation fields only. Never `*`: a translation row can still hold a
 * draft (`draft_doc`, `puck_document`, `draft_document`).
 */
const PAGE_SELECT = [
  "$id",
  "slug",
  "status",
  "visibility",
  "department_id",
  "campus_id",
  "translation_refs.$id",
  "translation_refs.locale",
  "translation_refs.is_published",
  "translation_refs.published_at",
  "translation_refs.published_doc",
  "translation_refs.title",
  "translation_refs.description",
];

type PageRow = Pick<
  Pages,
  "$id" | "slug" | "status" | "visibility" | "campus_id" | "department_id"
> & {
  translation_refs?: Pick<
    PageTranslations,
    "locale" | "is_published" | "published_doc" | "title" | "description"
  >[];
};

type UnitRow = Parameters<typeof unitEntries>[0];

const UNIT_COLUMNS = columns<UnitRow>({
  $id: true,
  active: true,
  campus_id: true,
  hero: true,
  logo: true,
  Name: true,
  slug: true,
});

/** Room for case and whitespace variants of the project addresses. */
const PROJECT_PAGE_LIMIT = 25;

function empty(): LoadedItem {
  return { entries: [], related: [] };
}

function projectPath(project: ProjectSlug): string {
  return `/${projectPageSlug(project)}`;
}

function pageTranslations(row: PageRow): PageTranslationText[] {
  return (row.translation_refs ?? []).flatMap((t) => {
    const locale = searchLocale(t.locale);
    return locale
      ? [
          {
            description: t.description ?? null,
            is_published: t.is_published ?? null,
            locale,
            published_doc: t.published_doc ?? null,
            title: t.title ?? null,
          },
        ]
      : [];
  });
}

/** Pages, unit pages, unit sub-pages and project pages, as the site serves them. */
export function pageLoader(db: AdminDb) {
  const nationalUnits = new Map<ProjectSlug, Promise<UnitRow | null>>();

  async function readPages(queries: string[]): Promise<PageRow[]> {
    const list = await db.listRows<Pages>({
      databaseId: DB,
      queries: [...queries, Query.select(PAGE_SELECT)],
      tableId: PAGE_TABLE,
    });
    return list.rows;
  }

  /** The unit the site routes at (slug, campus): active and public. */
  async function routedUnit(
    slug: string,
    campusId: string
  ): Promise<UnitRow | null> {
    const list = await db.listRows<Departments>({
      databaseId: DB,
      queries: [
        Query.equal("slug", slug),
        Query.equal("campus_id", campusId),
        Query.equal("active", true),
        Query.select(UNIT_COLUMNS),
        Query.limit(1),
      ],
      tableId: DEPARTMENT_TABLE,
    });
    const row = list.rows[0];
    return row && isPublicUnit(row) ? row : null;
  }

  /** The national (campus 5) unit that runs `project`; read once per execution. */
  function nationalUnit(project: ProjectSlug): Promise<UnitRow | null> {
    let unit = nationalUnits.get(project);
    if (!unit) {
      unit = routedUnit(PROJECT_UNIT_SLUGS[project], NATIONAL_CAMPUS_ID);
      nationalUnits.set(project, unit);
    }
    return unit;
  }

  /**
   * `projectPageIsGenuine` (apps/web/src/lib/unit-page.ts): stored at exactly
   * the project address; a hub project's page has no department, a national
   * project's page is bound to its national unit.
   */
  async function projectPageIsGenuine(
    row: PageRow,
    project: ProjectSlug
  ): Promise<boolean> {
    if (row.slug?.trim().toLowerCase() !== projectPageSlug(project)) {
      return false;
    }
    if (isHubProject(project)) {
      return row.department_id == null;
    }
    if (row.department_id == null) {
      return false;
    }
    const unit = await nationalUnit(project);
    return unit?.$id === row.department_id;
  }

  /**
   * Whether `/projects/<project>` serves this page instead of its coded hub
   * (`isServableProjectPage`): a published, public row with a published,
   * non-empty translation that is genuinely the project's. The site reads
   * project pages with guest permissions, so a signed-in-only page is not
   * served and the coded hub stays. The one rule for both `loadPage` and
   * `servableProjectPaths`.
   */
  async function isServableProjectPage(
    row: PageRow,
    project: ProjectSlug
  ): Promise<boolean> {
    if (
      row.status !== PagesStatus.PUBLISHED ||
      row.visibility !== PagesVisibility.PUBLIC ||
      !pageTranslations(row).some(hasPublishedContent)
    ) {
      return false;
    }
    return await projectPageIsGenuine(row, project);
  }

  async function servableProjectPaths(): Promise<Set<string>> {
    const rows = await readPages([
      Query.equal("slug", PROJECTS.map(projectPageSlug)),
      Query.limit(PROJECT_PAGE_LIMIT),
    ]);
    const paths = await Promise.all(
      rows.map(async (row) => {
        const owner = pageOwner(row.slug?.trim() ?? "");
        if (owner.kind !== "project") {
          return null;
        }
        const servable = await isServableProjectPage(row, owner.project);
        return servable ? projectPath(owner.project) : null;
      })
    );
    return new Set(paths.filter((path): path is string => path !== null));
  }

  /**
   * `publishedUnitSubPage`: the unit at `units/<campus>/<unit>` is routed
   * (active, public), owns the page by `department_id`, and the page is
   * stored at exactly the address the site builds from that unit.
   */
  async function unitOwnsSubPage(
    row: PageRow,
    unitSlug: string
  ): Promise<boolean> {
    const [, campusSegment, slug] = unitSlug.split("/");
    const campusId = campusSegmentToId(campusSegment);
    const name = parseUnitSubPageSlug(row.slug)?.name;
    if (!(campusId && slug && name && row.department_id)) {
      return false;
    }
    const unit = await routedUnit(slug, campusId);
    const unitAddress = unit
      ? unitPageSlug({ campusId: unit.campus_id, slug: unit.slug })
      : null;
    return (
      unit?.$id === row.department_id &&
      unitAddress !== null &&
      row.slug === unitSubPageSlug(unitAddress, name)
    );
  }

  async function loadProjectPage(
    row: PageRow,
    project: ProjectSlug,
    ctx: MapContext
  ): Promise<LoadedItem> {
    const path = projectPath(project);
    const servable = await isServableProjectPage(row, project);
    // A national unit gives its URL to a servable project page and takes it
    // back when the page stops being servable, so re-sync it either way.
    const unit = isHubProject(project) ? null : await nationalUnit(project);
    const related: SyncTarget[] = unit ? [{ id: unit.$id, type: "unit" }] : [];
    if (!servable) {
      return { codedSkip: { path, skip: false }, entries: [], related };
    }
    return {
      codedSkip: { path, skip: true },
      entries: pageEntries(row, pageTranslations(row), ctx),
      related,
    };
  }

  async function loadPage(id: string, ctx: MapContext): Promise<LoadedItem> {
    const [row] = await readPages([Query.equal("$id", id), Query.limit(1)]);
    if (!row) {
      return empty();
    }
    const owner = pageOwner(row.slug?.trim() ?? "");
    switch (owner.kind) {
      case "standalone":
        return {
          entries: pageEntries(row, pageTranslations(row), ctx),
          related: [],
        };
      case "unitSubPage":
        return {
          entries: (await unitOwnsSubPage(row, owner.unitSlug))
            ? pageEntries(row, pageTranslations(row), ctx)
            : [],
          related: [],
        };
      case "unit":
        // The unit's own entry carries its page's text.
        return {
          entries: [],
          related: row.department_id
            ? [{ id: row.department_id, type: "unit" }]
            : [],
        };
      case "project":
        return await loadProjectPage(row, owner.project, ctx);
      default:
        return empty();
    }
  }

  /**
   * The unit's own published page (`publishedUnitPage`): stored at the unit
   * address, bound by `department_id`, published and public.
   */
  async function boundUnitPage(
    unit: UnitRow
  ): Promise<PageTranslationText[] | null> {
    const slug = unitPageSlug({ campusId: unit.campus_id, slug: unit.slug });
    if (!slug) {
      return null;
    }
    const [page] = await readPages([Query.equal("slug", slug), Query.limit(1)]);
    if (
      !page ||
      page.department_id == null ||
      page.department_id !== unit.$id ||
      page.status !== PagesStatus.PUBLISHED ||
      page.visibility !== PagesVisibility.PUBLIC
    ) {
      return null;
    }
    return pageTranslations(page);
  }

  async function loadUnit(id: string, ctx: MapContext): Promise<LoadedItem> {
    const row = await getRowOrNull<UnitRow>(
      db,
      DEPARTMENT_TABLE,
      id,
      UNIT_COLUMNS
    );
    // The site routes only `active: true` units (a null `active` 404s there).
    if (!(row?.active === true && isPublicUnit(row))) {
      return empty();
    }
    const project = nationalProjectForUnit(row);
    const [overlay, page, served] = await Promise.all([
      contentTranslations(db, "department", id),
      boundUnitPage(row),
      project ? servableProjectPaths() : Promise.resolve(new Set<string>()),
    ]);
    const replacedByProjectPage =
      project !== null && served.has(projectPath(project));
    return {
      entries: unitEntries(row, { overlay, page, replacedByProjectPage }, ctx),
      related: [],
    };
  }

  return { loadPage, loadUnit, servableProjectPaths };
}
