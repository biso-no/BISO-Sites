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
import type { SearchEntry, SearchType } from "@repo/shared/search/types";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import { pageLoader } from "./pages";
import type { SyncTarget } from "./resolve";
import {
  type AdminDb,
  columns,
  contentTranslations,
  getRowOrNull,
  pagedIds,
} from "./rows";

export type { AdminDb } from "./rows";

export interface LoadedItem {
  /** A project page took over (`skip`) or gave back its coded hub's URL. */
  codedSkip?: { path: string; skip: boolean };
  /** Empty when the item is gone or not public: its entries are removed. */
  entries: SearchEntry[];
  /** Other items whose entries depend on this one. */
  related: SyncTarget[];
}

type LoadTarget = Exclude<SyncTarget, { type: "department-related" }>;
type ListedType = Exclude<SearchType, "coded">;

export interface Source {
  departmentRelated(departmentId: string): Promise<SyncTarget[]>;
  /** Pages of ids, for the reindex. The mappers still decide what is public. */
  listIds(type: ListedType): AsyncIterable<string[]>;
  load(target: LoadTarget, ctx: MapContext): Promise<LoadedItem>;
  /** `/projects/<slug>` paths that a servable project page has taken over. */
  servableProjectPaths(): Promise<Set<string>>;
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

/** The tables that show a department's name, and the column that links it. */
const DEPARTMENT_LINKS: readonly {
  column: string;
  table: string;
  type: ListedType;
}[] = [
  { column: "department_id", table: "events", type: "event" },
  { column: "department_id", table: "jobs", type: "job" },
  { column: "department_id", table: "news", type: "news" },
  { column: "departmentId", table: "webshop_products", type: "product" },
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
    type: LoadTarget["type"],
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
    departmentRelated: async (departmentId) => {
      const targets: SyncTarget[] = [];
      for (const link of DEPARTMENT_LINKS) {
        const filters = [Query.equal(link.column, departmentId)];
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
