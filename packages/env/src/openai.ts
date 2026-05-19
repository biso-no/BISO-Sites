import { z } from "zod";

export const openaiServer = {
  OPENAI_API_KEY: z.string().optional(),
};
