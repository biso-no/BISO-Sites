import { z } from "zod";

export const tfsoServer = {
  TFSO_APP_ID: z.string().optional(),
  TFSO_USERNAME: z.string().optional(),
  TFSO_PASSWORD: z.string().optional(),
  TFSO_REST_CLIENT_ID: z.string().optional(),
  TFSO_REST_CLIENT_SECRET: z.string().optional(),
  TFSO_REST_ORG_ID: z.string().optional(),
  TFSO_SHOP_TRANSACTION_TYPE_NUMBER: z.string().optional(),
  TFSO_VIPPS_RECEIVABLE_ACCOUNT: z.string().optional(),
};
