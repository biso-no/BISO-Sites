import { z } from "zod";
import {
  appwriteClient,
  appwriteServer,
  azureGraphServer,
  azureServer,
  openaiServer,
  sharepointServer,
  urlsClient,
} from "@repo/env";

export const env = z
  .object({
    ...appwriteServer,
    ...appwriteClient,
    ...azureServer,
    ...azureGraphServer,
    ...openaiServer,
    ...sharepointServer,
    ...urlsClient,
  })
  .parse(process.env);
