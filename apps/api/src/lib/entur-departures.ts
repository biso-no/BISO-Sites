import { Permission, Query, Role, type TablesDB } from "@repo/api";
import type { Departures, StopPlaces } from "@repo/api/types/appwrite";

const ENTUR_GRAPHQL_ENDPOINT =
  "https://api.entur.io/journey-planner/v3/graphql";
// Entur's Journey Planner v3 is open (NLOD licence) and needs NO API key/token.
// The only requirement is identifying via the `ET-Client-Name` header in
// `<company>-<application>` format — consumers that don't are strictly
// rate-limited and may be blocked. See https://developer.entur.org.
const DEFAULT_ENTUR_CLIENT_NAME = "biso-departures";
const DEFAULT_TIME_RANGE_SECONDS = 7200;
const DEFAULT_NUMBER_OF_DEPARTURES = 10;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_DATABASE_ID = "app";
const DEFAULT_DEPARTURES_TABLE_ID = "departures";
const DEFAULT_STOP_PLACES_TABLE_ID = "stop_places";
const PAGE_SIZE = 100;

const STOP_DEPARTURES_QUERY = `
  query StopDepartures($id: String!, $timeRange: Int!, $numberOfDepartures: Int!) {
    stopPlace(id: $id) {
      id
      name
      estimatedCalls(timeRange: $timeRange, numberOfDepartures: $numberOfDepartures) {
        realtime
        aimedArrivalTime
        aimedDepartureTime
        expectedArrivalTime
        expectedDepartureTime
        actualArrivalTime
        actualDepartureTime
        date
        forBoarding
        forAlighting
        destinationDisplay { frontText }
        quay { id }
        serviceJourney {
          id
          journeyPattern { line { id name transportMode } }
        }
      }
    }
  }
`;

export interface EnturLine {
  id: string | null;
  name: string | null;
  transportMode: string | null;
}

export interface EstimatedCall {
  actualArrivalTime: string | null;
  actualDepartureTime: string | null;
  aimedArrivalTime: string | null;
  aimedDepartureTime: string | null;
  date: string | null;
  destinationDisplay: {
    frontText: string | null;
  } | null;
  expectedArrivalTime: string | null;
  expectedDepartureTime: string | null;
  forAlighting: boolean | null;
  forBoarding: boolean | null;
  quay: {
    id: string | null;
  } | null;
  realtime: boolean;
  serviceJourney: {
    id: string | null;
    journeyPattern: {
      line: EnturLine | null;
    } | null;
  } | null;
}

export interface StopPlaceDepartures {
  estimatedCalls: EstimatedCall[];
  id: string;
  name: string | null;
}

interface EnturGraphqlResponse {
  data?: {
    stopPlace?: StopPlaceDepartures | null;
  };
  errors?: unknown[];
}

export interface DepartureSyncConfig {
  databaseId: string;
  departuresTableId: string;
  enturClientName: string;
  fetchTimeoutMs: number;
  numberOfDepartures: number;
  stopPlacesTableId: string;
  timeRangeSeconds: number;
}

export interface DepartureSyncFailure {
  id: string;
  reason: string;
}

export interface DepartureSyncResult {
  failed: DepartureSyncFailure[];
  skipped: string[];
  updated: string[];
}

interface SyncLogger {
  error: (message: string) => void;
  log: (message: string) => void;
}

type Fetcher = typeof fetch;

type DepartureRowData = Pick<
  Departures,
  "estimatedCalls" | "stopPlaceId" | "stopPlaceName" | "updatedAt"
>;

interface SyncDeparturesOptions {
  config?: DepartureSyncConfig;
  db: TablesDB;
  fetcher?: Fetcher;
  logger?: SyncLogger;
  now?: () => Date;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDepartureSyncConfig(
  env: NodeJS.ProcessEnv = process.env
): DepartureSyncConfig {
  return {
    databaseId: env.APPWRITE_DATABASE_ID ?? DEFAULT_DATABASE_ID,
    departuresTableId:
      env.APPWRITE_DEPARTURES_TABLE_ID ??
      env.APPWRITE_DEPARTURES_COLLECTION_ID ??
      DEFAULT_DEPARTURES_TABLE_ID,
    enturClientName: env.ENTUR_CLIENT_NAME ?? DEFAULT_ENTUR_CLIENT_NAME,
    fetchTimeoutMs: parsePositiveInteger(
      env.ENTUR_FETCH_TIMEOUT_MS,
      DEFAULT_FETCH_TIMEOUT_MS
    ),
    numberOfDepartures: parsePositiveInteger(
      env.ENTUR_NUM_DEPARTURES,
      DEFAULT_NUMBER_OF_DEPARTURES
    ),
    stopPlacesTableId:
      env.APPWRITE_STOP_PLACES_TABLE_ID ??
      env.APPWRITE_STOP_PLACES_COLLECTION_ID ??
      DEFAULT_STOP_PLACES_TABLE_ID,
    timeRangeSeconds: parsePositiveInteger(
      env.ENTUR_TIME_RANGE,
      DEFAULT_TIME_RANGE_SECONDS
    ),
  };
}

export function getDepartureSyncSecret(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  // CRON_SECRET is the single shared secret for every scheduled endpoint.
  // ENTUR_SYNC_SECRET is a deprecated fallback for older deployments.
  return env.CRON_SECRET ?? env.ENTUR_SYNC_SECRET;
}

export function sanitizeAppwriteRowId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getErrorCode(error: unknown): number | undefined {
  if (!(typeof error === "object" && error !== null && "code" in error)) {
    return;
  }

  const { code } = error as { code?: unknown };
  if (typeof code === "number") {
    return code;
  }
  if (typeof code === "string") {
    const parsed = Number.parseInt(code, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return;
}

function isEnabledStopPlace(row: StopPlaces) {
  return row.enabled !== false;
}

async function fetchStopDepartures(
  stopPlaceId: string,
  config: DepartureSyncConfig,
  fetcher: Fetcher,
  logger: SyncLogger
): Promise<StopPlaceDepartures | null> {
  try {
    const response = await fetcher(ENTUR_GRAPHQL_ENDPOINT, {
      body: JSON.stringify({
        query: STOP_DEPARTURES_QUERY,
        variables: {
          id: stopPlaceId,
          numberOfDepartures: config.numberOfDepartures,
          timeRange: config.timeRangeSeconds,
        },
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "ET-Client-Name": config.enturClientName,
      },
      method: "POST",
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });

    if (!response.ok) {
      logger.error(
        `Entur request failed for ${stopPlaceId}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = (await response.json()) as EnturGraphqlResponse;
    if (json.errors) {
      logger.error(
        `Entur GraphQL errors for ${stopPlaceId}: ${JSON.stringify(json.errors)}`
      );
      return null;
    }

    return json.data?.stopPlace ?? null;
  } catch (error) {
    logger.error(`Entur fetch error for ${stopPlaceId}: ${formatError(error)}`);
    return null;
  }
}

async function listStopPlaceIds(
  db: TablesDB,
  config: DepartureSyncConfig
): Promise<string[]> {
  const rows: StopPlaces[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await db.listRows<StopPlaces>({
      databaseId: config.databaseId,
      queries: [Query.limit(PAGE_SIZE), Query.offset(offset)],
      tableId: config.stopPlacesTableId,
      total: true,
    });

    rows.push(...response.rows);
    total = response.total;
    offset += response.rows.length;

    if (response.rows.length === 0) {
      break;
    }
  }

  return rows
    .filter(isEnabledStopPlace)
    .map((row) => row.stopPlaceId)
    .filter((value) => value.trim().length > 0);
}

async function upsertStopDepartures(
  db: TablesDB,
  stop: StopPlaceDepartures,
  config: DepartureSyncConfig,
  now: () => Date
): Promise<void> {
  const rowId = sanitizeAppwriteRowId(stop.id);
  const data: DepartureRowData = {
    estimatedCalls: JSON.stringify(stop.estimatedCalls),
    stopPlaceId: stop.id,
    stopPlaceName: stop.name,
    updatedAt: now().toISOString(),
  };

  try {
    await db.updateRow<Departures>({
      data,
      databaseId: config.databaseId,
      rowId,
      tableId: config.departuresTableId,
    });
  } catch (error) {
    if (getErrorCode(error) !== 404) {
      throw error;
    }

    try {
      await db.createRow<Departures>({
        data,
        databaseId: config.databaseId,
        permissions: [Permission.read(Role.any())],
        rowId,
        tableId: config.departuresTableId,
      });
    } catch (createError) {
      if (getErrorCode(createError) !== 409) {
        throw createError;
      }

      await db.updateRow<Departures>({
        data,
        databaseId: config.databaseId,
        rowId,
        tableId: config.departuresTableId,
      });
    }
  }
}

export async function syncDepartures({
  config = getDepartureSyncConfig(),
  db,
  fetcher = fetch,
  logger = console,
  now = () => new Date(),
}: SyncDeparturesOptions): Promise<DepartureSyncResult> {
  const stopPlaceIds = await listStopPlaceIds(db, config);
  const fetchResults = await Promise.all(
    stopPlaceIds.map(async (id) => ({
      id,
      stop: await fetchStopDepartures(id, config, fetcher, logger),
    }))
  );

  const stops = fetchResults
    .map((result) => result.stop)
    .filter((stop): stop is StopPlaceDepartures => Boolean(stop));
  const updated: string[] = [];
  const failed: DepartureSyncFailure[] = [];

  for (const stop of stops) {
    try {
      await upsertStopDepartures(db, stop, config, now);
      updated.push(stop.id);
      logger.log(
        `Updated stop ${stop.name ?? "Unknown"} (${stop.id}) with ${stop.estimatedCalls.length} departures`
      );
    } catch (error) {
      const reason = formatError(error);
      failed.push({ id: stop.id, reason });
      logger.error(`Failed to upsert row for ${stop.id}: ${reason}`);
    }
  }

  const skipped = fetchResults
    .filter((result) => !result.stop)
    .map((result) => result.id);

  return {
    failed,
    skipped,
    updated,
  };
}
