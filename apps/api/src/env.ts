import { z } from "zod";
import {
  appwriteClient,
  appwriteServer,
  azureGraphServer,
  azureServer,
  sharepointServer,
  stripeServer,
  urlsClient,
  vippsServer,
  woocommerceServer,
} from "@repo/env";

export const env = z
  .object({
    ...appwriteServer,
    ...appwriteClient,
    ...azureServer,
    ...azureGraphServer,
    ...sharepointServer,
    ...vippsServer,
    ...stripeServer,
    ...woocommerceServer,
    ...urlsClient,
  })
  .parse(process.env);
