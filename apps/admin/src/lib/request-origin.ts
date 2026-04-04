import { headers } from "next/headers";

function normalizeOrigin(url: string): string {
  return new URL(url).origin;
}

export async function getRequestOrigin(): Promise<string> {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return normalizeOrigin(configuredBaseUrl);
  }

  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const origin = requestHeaders.get("origin");
  if (origin) {
    return normalizeOrigin(origin);
  }

  const host = requestHeaders.get("host");
  if (host) {
    return `https://${host}`;
  }

  throw new Error("Unable to resolve request origin");
}
