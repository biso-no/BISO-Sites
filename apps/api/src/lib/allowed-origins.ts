const PRODUCTION_ORIGINS = [
  "https://admin.biso.no",
  "https://web.biso.no",
  "https://public.biso.no",
  "https://biso.no",
] as const;

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
] as const;

export function getAllowedOrigins(
  nodeEnv: string | undefined = process.env.NODE_ENV
): Set<string> {
  const origins: string[] = [...PRODUCTION_ORIGINS];

  if (nodeEnv !== "production") {
    origins.push(...DEVELOPMENT_ORIGINS);
  }

  return new Set(origins);
}

export function isAllowedOrigin(
  origin: string | null,
  nodeEnv?: string
): boolean {
  return Boolean(origin && getAllowedOrigins(nodeEnv).has(origin));
}
