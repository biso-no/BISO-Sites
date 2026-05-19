import { z } from "zod";

export const urlsClient = {
  NEXT_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_API_BASE_URL: z.string().default("http://localhost:3003"),
  API_BASE_URL: z.string().optional(),
};
