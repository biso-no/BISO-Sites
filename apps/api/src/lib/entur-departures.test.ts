import { describe, expect, it, vi } from "vitest";
import {
  getDepartureSyncConfig,
  sanitizeAppwriteRowId,
  syncDepartures,
} from "./entur-departures";

describe("Entur departures sync helpers", () => {
  it("keeps the legacy Appwrite row id sanitization", () => {
    expect(sanitizeAppwriteRowId("NSR:StopPlace:59605")).toBe(
      "NSRStopPlace59605"
    );
  });

  it("uses collection env vars as table id fallbacks during migration", () => {
    const config = getDepartureSyncConfig({
      ...process.env,
      APPWRITE_DATABASE_ID: "legacy-db",
      APPWRITE_DEPARTURES_COLLECTION_ID: "legacy-departures",
      APPWRITE_STOP_PLACES_COLLECTION_ID: "legacy-stops",
      ENTUR_NUM_DEPARTURES: "12",
      ENTUR_TIME_RANGE: "9000",
    });

    expect(config.databaseId).toBe("legacy-db");
    expect(config.departuresTableId).toBe("legacy-departures");
    expect(config.stopPlacesTableId).toBe("legacy-stops");
    expect(config.numberOfDepartures).toBe(12);
    expect(config.timeRangeSeconds).toBe(9000);
  });

  it("fetches enabled stop places and updates Entur departures", async () => {
    const updateRow = vi.fn().mockResolvedValue({});
    const db = {
      createRow: vi.fn().mockResolvedValue({}),
      listRows: vi.fn().mockResolvedValue({
        rows: [
          {
            $id: "stop-row",
            $createdAt: "2026-04-24T00:00:00.000Z",
            $databaseId: "app",
            $permissions: [],
            $sequence: 1,
            $tableId: "stop_places",
            $updatedAt: "2026-04-24T00:00:00.000Z",
            campus_id: "stavanger",
            enabled: true,
            name: "Stavanger stadion",
            stopPlaceId: "NSR:StopPlace:59605",
          },
          {
            $id: "disabled-stop-row",
            $createdAt: "2026-04-24T00:00:00.000Z",
            $databaseId: "app",
            $permissions: [],
            $sequence: 2,
            $tableId: "stop_places",
            $updatedAt: "2026-04-24T00:00:00.000Z",
            campus_id: "oslo",
            enabled: false,
            name: "Disabled",
            stopPlaceId: "NSR:StopPlace:1",
          },
        ],
        total: 2,
      }),
      updateRow,
    };
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          stopPlace: {
            estimatedCalls: [
              {
                expectedDepartureTime: "2026-04-24T12:00:00+02:00",
                realtime: true,
              },
            ],
            id: "NSR:StopPlace:59605",
            name: "Stavanger stadion",
          },
        },
      }),
      ok: true,
      status: 200,
      statusText: "OK",
    });

    const result = await syncDepartures({
      db: db as never,
      fetcher: fetcher as never,
      logger: {
        error: vi.fn(),
        log: vi.fn(),
      },
      now: () => new Date("2026-04-24T10:00:00.000Z"),
    });

    expect(result).toEqual({
      failed: [],
      skipped: [],
      updated: ["NSR:StopPlace:59605"],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stopPlaceId: "NSR:StopPlace:59605",
          stopPlaceName: "Stavanger stadion",
          updatedAt: "2026-04-24T10:00:00.000Z",
        }),
        databaseId: "app",
        rowId: "NSRStopPlace59605",
        tableId: "departures",
      })
    );
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("creates missing departure rows with public read permission", async () => {
    const notFound = Object.assign(new Error("Missing row"), { code: 404 });
    const createRow = vi.fn().mockResolvedValue({});
    const db = {
      createRow,
      listRows: vi.fn().mockResolvedValue({
        rows: [
          {
            $id: "stop-row",
            $createdAt: "2026-04-24T00:00:00.000Z",
            $databaseId: "app",
            $permissions: [],
            $sequence: 1,
            $tableId: "stop_places",
            $updatedAt: "2026-04-24T00:00:00.000Z",
            campus_id: "stavanger",
            enabled: true,
            name: "Stavanger stadion",
            stopPlaceId: "NSR:StopPlace:59605",
          },
        ],
        total: 1,
      }),
      updateRow: vi.fn().mockRejectedValueOnce(notFound).mockResolvedValue({}),
    };
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          stopPlace: {
            estimatedCalls: [],
            id: "NSR:StopPlace:59605",
            name: "Stavanger stadion",
          },
        },
      }),
      ok: true,
      status: 200,
      statusText: "OK",
    });

    await syncDepartures({
      db: db as never,
      fetcher: fetcher as never,
      logger: {
        error: vi.fn(),
        log: vi.fn(),
      },
      now: () => new Date("2026-04-24T10:00:00.000Z"),
    });

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ['read("any")'],
        rowId: "NSRStopPlace59605",
      })
    );
  });
});
