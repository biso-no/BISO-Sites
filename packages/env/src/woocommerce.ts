import { z } from "zod";

export const woocommerceServer = {
  WC_CONSUMER_KEY: z.string().optional(),
  WC_CONSUMER_SECRET: z.string().optional(),
};
