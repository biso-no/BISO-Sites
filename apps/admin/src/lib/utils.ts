import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isProd =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";
