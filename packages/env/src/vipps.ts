import { z } from "zod";

export const vippsServer = {
  VIPPS_CLIENT_ID: z.string().optional(),
  VIPPS_CLIENT_SECRET: z.string().optional(),
  VIPPS_MERCHANT_SERIAL_NUMBER: z.string().optional(),
  VIPPS_SUBSCRIPTION_KEY: z.string().optional(),
  VIPPS_TEST_MODE: z.string().default("false"),
  VIPPS_CALLBACK_TOKEN: z.string().optional(),
};
