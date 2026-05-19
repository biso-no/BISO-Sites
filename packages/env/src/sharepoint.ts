import { z } from "zod";

export const sharepointServer = {
  SHAREPOINT_CLIENT_ID: z.string().optional(),
  SHAREPOINT_CLIENT_SECRET: z.string().optional(),
  SHAREPOINT_TENANT_ID: z.string().optional(),
  SHAREPOINT_SITES: z.string().optional(),
  SHAREPOINT_DOCUMENTS_DRIVE_ID: z.string().optional(),
};
