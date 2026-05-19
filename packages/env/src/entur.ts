import { z } from "zod";

export const enturServer = {
  ENTUR_SYNC_SECRET: z.string().optional(),
  ENTUR_CLIENT_NAME: z.string().default("biso.app/1.0"),
  ENTUR_TIME_RANGE: z.string().default("7200"),
  ENTUR_NUM_DEPARTURES: z.string().default("10"),
  ENTUR_FETCH_TIMEOUT_MS: z.string().default("10000"),
};
