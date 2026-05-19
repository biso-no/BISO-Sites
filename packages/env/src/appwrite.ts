import { z } from "zod";

export const appwriteServer = {
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().default("app"),
  APPWRITE_ORDERS_COLLECTION_ID: z.string().optional(),
  APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID: z.string().optional(),
  APPWRITE_CAMPUS_BOARD_FUNCTION_ID: z.string().optional(),
};

export const appwriteClient = {
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z
    .string()
    .default("https://appwrite.biso.no/v1"),
  NEXT_PUBLIC_APPWRITE_PROJECT: z.string().default("biso"),
  // Legacy aliases still referenced in some components — keep in sync with above
  APPWRITE_ENDPOINT: z.string().optional(),
  APPWRITE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().optional(),
};
