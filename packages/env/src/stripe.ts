import { z } from "zod";

export const stripeServer = {
  STRIPE_SECRET_KEY: z.string().optional(),
};
