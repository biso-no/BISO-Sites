import { Query } from "@repo/api";
import type { Departments } from "@repo/api/types/appwrite";
import {
  DocumentsStatus,
  EventsStatus,
  JobsStatus,
  NewsStatus,
  PagesStatus,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import type {
  MapContext,
  TranslationText,
} from "@repo/shared/search/entries/common";
import { documentEntries } from "@repo/shared/search/entries/document";
import { eventEntries } from "@repo/shared/search/entries/event";
import { jobEntries } from "@repo/shared/search/entries/job";
import { newsEntries } from "@repo/shared/search/entries/news";
import { productEntries } from "@repo/shared/search/entries/product";
import type {
  SearchEntry,
  SearchLocale,
  SearchType,
} from "@repo/shared/search/types";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import { pageLoader, type ServedProjectPaths } from "./pages";
import type { ItemTarget, SyncTarget } from "./resolve";
import {
  type AdminDb,
  columns,
  contentTranslations,
  getRowOrNull,
  pagedIds,
} from "./rows";

export type { AdminDb } from "./rows";

export interface LoadedItem {
  /**
   * A project page's coded hub: in `skipIn` the page has taken the URL over,
   * in the other locales the hub entry comes back.
   */
  codedSkip?: { path: string; skipIn: ReadonlySet<SearchLocale> };
  /** Empty when the item is gone or not public: its entries are removed. */
  entries: SearchEntry[];
  /** Other items whose entries depend on this one. */
  related: SyncTarget[];
}

type ListedType = Exclude<SearchType, "coded">;

export interface Source {
  /**
   * The items linked to a department that can have entries (published, and
   * for events not finished at `now`).
   */
  departmentRelated(departmentId: string, now: Date): Promise<SyncTarget[]>;
  /** Pages of ids, for the reindex. The mappers still decide what is public. */
  listIds(type: ListedType): AsyncIterable<string[]>;
  load(target: ItemTarget, ctx: MapContext): Promise<LoadedItem>;
  /**
   * `/projects/<slug>` paths that a servable project page has taken over, and
   * the locales it serves them in (the site decides per request locale).
   */
  servableProjectPaths(): Promise<ServedProjectPaths>;
}

type DepartmentName = (id: string | null | undefined) => Promise<string | null>;

interface ContentSpec<Row> {
  columns: string[];
  department: (row: Row) => string | null;
  map: (
    row: Row,
    translations: TranslationText[],
    ctx: MapContext
  ) => SearchEntry[];
  table: string;
}

type EventRow = Parameters<typeof eventEntries>[0];
type NewsRow = Parameters<typeof newsEntries>[0];
type JobRow = Parameters<typeof jobEntries>[0];
type ProductRow = Parameters<typeof productEntries>[0];
type DocumentRow = Parameters<typeof documentEntries>[0];

const EVENT: ContentSpec<EventRow> = {
  columns: columns<EventRow>({
    $id: true,
    campus_id: true,
    category: true,
    collection_id: true,
    cover_pattern: true,
    department_id: true,
    end_date: true,
    image: true,
    is_collection: true,
    location: true,
    member_only: true,
    member_price: true,
    price: true,
    pricing_mode: true,
    slug: true,
    start_date: true,
    status: true,
    tags: true,
  }),
  department: (row) => row.department_id,
  map: eventEntries,
  table: "events",
};

const NEWS: ContentSpec<NewsRow> = {
  columns: columns<NewsRow>({
    $createdAt: true,
    $id: true,
    campus_id: true,
    department_id: true,
    image: true,
    slug: true,
    status: true,
  }),
  department: (row) => row.department_id,
  map: newsEntries,
  table: "news",
};

const JOB: ContentSpec<JobRow> = {
  columns: columns<JobRow>({
    $id: true,
    application_deadline: true,
    campus_id: true,
    department_id: true,
    slug: true,
    status: true,
  }),
  department: (row) => row.department_id,
  map: jobEntries,
  table: "jobs",
};

const PRODUCT: ContentSpec<ProductRow> = {
  columns: columns<ProductRow>({
    $id: true,
    campus_id: true,
    category: true,
    cover_pattern: true,
    departmentId: true,
    image: true,
    images: true,
    inventory_mode: true,
    member_only: true,
    member_price: true,
    regular_price: true,
    slug: true,
    status: true,
    stock: true,
    tags: true,
    unlisted: true,
  }),
  department: (row) => row.departmentId,
  map: productEntries,
  table: "webshop_products",
};

const DOCUMENT_TABLE = "documents";
const DOCUMENT_COLUMNS = columns<DocumentRow>({
  $id: true,
  campus_id: true,
  category: true,
  description: true,
  language: true,
  scope: true,
  status: true,
  title: true,
});

/**
 * "Has not finished yet" at `now`, as the site's `upcomingQueries`
 * (apps/web/src/lib/data/queries.ts): `end_date`, else `start_date`, and rows
 * with neither are kept.
 */
function upcomingEventQueries(now: Date): string[] {
  const nowIso = now.toISOString();
  return [
    Query.or([
      Query.greaterThanEqual("end_date", nowIso),
      Query.and([
        Query.isNull("end_date"),
        Query.greaterThanEqual("start_date", nowIso),
      ]),
      Query.and([Query.isNull("end_date"), Query.isNull("start_date")]),
    ]),
  ];
}

/**
 * The rows that depend on a department, and the column that links them: the
 * content that shows its name, and the pages it owns (a unit sub-page or a
 * national project page is indexed only while its unit is routed). Only rows
 * that can have entries are listed: a draft or a finished event already had
 * its entries removed by its own row event, and re-reading it would only
 * delete nothing again. `sync-finago-projects` touches many departments every
 * day, so this keeps that fan-out small.
 */
const DEPARTMENT_LINKS: readonly {
  column: string;
  filters: (now: Date) => string[];
  table: string;
  type: ListedType;
}[] = [
  {
    column: "department_id",
    filters: (now) => [
      Query.equal("status", EventsStatus.PUBLISHED),
      ...upcomingEventQueries(now),
    ],
    table: "events",
    type: "event",
  },
  {
    column: "department_id",
    filters: () => [Query.equal("status", JobsStatus.PUBLISHED)],
    table: "jobs",
    type: "job",
  },
  {
    column: "department_id",
    filters: () => [Query.equal("status", NewsStatus.PUBLISHED)],
    table: "news",
    type: "news",
  },
  {
    column: "departmentId",
    filters: () => [Query.equal("status", WebshopProductsStatus.PUBLISHED)],
    table: "webshop_products",
    type: "product",
  },
  {
    column: "department_id",
    filters: () => [Query.equal("status", PagesStatus.PUBLISHED)],
    table: "pages",
    type: "page",
  },
];

/**
 * Each type's table and its cheap public pre-filter for the reindex listing.
 * Only conditions every mapper also requires; the mappers still decide.
 */
const LISTINGS: Record<ListedType, { filters: string[]; table: string }> = {
  document: {
    filters: [Query.equal("status", DocumentsStatus.PUBLISHED)],
    table: DOCUMENT_TABLE,
  },
  event: {
    filters: [Query.equal("status", EventsStatus.PUBLISHED)],
    table: "events",
  },
  job: {
    filters: [Query.equal("status", JobsStatus.PUBLISHED)],
    table: "jobs",
  },
  news: {
    filters: [Query.equal("status", NewsStatus.PUBLISHED)],
    table: "news",
  },
  page: {
    filters: [Query.equal("status", PagesStatus.PUBLISHED)],
    table: "pages",
  },
  product: {
    filters: [Query.equal("status", WebshopProductsStatus.PUBLISHED)],
    table: "webshop_products",
  },
  unit: { filters: [Query.equal("active", true)], table: "departments" },
};

/**
 * Department display names (`unitDisplayName`), each read at most once. Make
 * one per execution, so a rename is seen by the next one.
 */
export function departmentNames(db: AdminDb): DepartmentName {
  const cache = new Map<string, Promise<string | null>>();
  async function read(id: string): Promise<string | null> {
    const row = await getRowOrNull<Pick<Departments, "Name">>(
      db,
      "departments",
      id,
      ["$id", "Name"]
    );
    return row ? unitDisplayName(row.Name) || null : null;
  }
  return (id) => {
    if (!id) {
      return Promise.resolve(null);
    }
    let name = cache.get(id);
    if (!name) {
      name = read(id);
      cache.set(id, name);
    }
    return name;
  };
}

/**
 * Appwrite reads for the sync, through the admin `db`. Every load re-reads
 * the item: the event body is never trusted as its current state.
 */
export function appwriteSource(
  db: AdminDb,
  opts: { departmentName: DepartmentName }
): Source {
  const pages = pageLoader(db);

  async function loadContent<Row>(
    spec: ContentSpec<Row>,
    type: ItemTarget["type"],
    id: string,
    ctx: MapContext
  ): Promise<LoadedItem> {
    const row = await getRowOrNull<Row>(db, spec.table, id, spec.columns);
    if (!row) {
      return { entries: [], related: [] };
    }
    const [translations, name] = await Promise.all([
      contentTranslations(db, type, id),
      opts.departmentName(spec.department(row)),
    ]);
    const mapCtx: MapContext = { ...ctx, departmentName: () => name };
    return { entries: spec.map(row, translations, mapCtx), related: [] };
  }

  async function loadDocument(
    id: string,
    ctx: MapContext
  ): Promise<LoadedItem> {
    const row = await getRowOrNull<DocumentRow>(
      db,
      DOCUMENT_TABLE,
      id,
      DOCUMENT_COLUMNS
    );
    return { entries: row ? documentEntries(row, ctx) : [], related: [] };
  }

  return {
    departmentRelated: async (departmentId, now) => {
      const targets: SyncTarget[] = [];
      for (const link of DEPARTMENT_LINKS) {
        const filters = [
          Query.equal(link.column, departmentId),
          ...link.filters(now),
        ];
        for await (const ids of pagedIds(db, link.table, filters)) {
          targets.push(...ids.map((id) => ({ id, type: link.type })));
        }
      }
      return targets;
    },
    listIds: (type) => {
      const { filters, table } = LISTINGS[type];
      return pagedIds(db, table, filters);
    },
    load: (target, ctx) => {
      switch (target.type) {
        case "event":
          return loadContent(EVENT, "event", target.id, ctx);
        case "news":
          return loadContent(NEWS, "news", target.id, ctx);
        case "job":
          return loadContent(JOB, "job", target.id, ctx);
        case "product":
          return loadContent(PRODUCT, "product", target.id, ctx);
        case "document":
          return loadDocument(target.id, ctx);
        case "page":
          return pages.loadPage(target.id, ctx);
        case "unit":
          return pages.loadUnit(target.id, ctx);
        default:
          throw new Error(`Unknown search type: ${String(target)}`);
      }
    },
    servableProjectPaths: () => pages.servableProjectPaths(),
  };
}
