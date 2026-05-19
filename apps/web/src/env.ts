import { z } from "zod";
import {
  appwriteClient,
  appwriteServer,
  openaiServer,
  sharepointServer,
  urlsClient,
  vippsServer,
} from "@repo/env";

export const env = z
  .object({
    ...appwriteServer,
    ...appwriteClient,
    ...vippsServer,
    ...openaiServer,
    ...sharepointServer,
    ...urlsClient,
    CRON_SECRET: z.string().optional(),
  })
  .parse(process.env);
