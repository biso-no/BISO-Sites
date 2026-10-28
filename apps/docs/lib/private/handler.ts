import type { Viewer } from "@/lib/auth/viewer";
import { isPrivateName, MAX_PRIVATE_NAMES, type PrivateName } from "./registry";
import type { PrivateValueSource } from "./types";

export type PrivateResponse =
  | { state: "signed-out" }
  | { state: "forbidden" }
  | { state: "unavailable" }
  | { state: "ok"; values: Partial<Record<PrivateName, string>> };

export interface PrivateHandlerDeps {
  getSource: () => PrivateValueSource | null;
  getViewer: () => Promise<Viewer>;
}

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function parseNames(url: string): PrivateName[] | null {
  const raw = new URL(url).searchParams.get("names") ?? "";
  const names = [
    ...new Set(
      raw
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0 || names.length > MAX_PRIVATE_NAMES) {
    return null;
  }
  return names.every(isPrivateName) ? (names as PrivateName[]) : null;
}

/**
 * Builds the GET handler. The viewer check comes before the source is even
 * created, so a signed-out or forbidden visitor never reaches the source.
 */
export function createPrivateHandler({
  getSource,
  getViewer,
}: PrivateHandlerDeps) {
  return async function handle(request: Request): Promise<Response> {
    const names = parseNames(request.url);
    if (!names) {
      return json({ error: "Invalid names" }, 400);
    }

    const viewer = await getViewer();
    if (!viewer.signedIn) {
      return json({ state: "signed-out" } satisfies PrivateResponse);
    }
    if (viewer.access === null) {
      return json({ state: "forbidden" } satisfies PrivateResponse);
    }

    try {
      const source = getSource();
      if (!source) {
        return json({ state: "unavailable" } satisfies PrivateResponse);
      }
      const found = await source.get(names);
      const values: Partial<Record<PrivateName, string>> = {};
      for (const name of names) {
        const value = found[name];
        if (typeof value === "string") {
          values[name] = value;
        }
      }
      return json({ state: "ok", values } satisfies PrivateResponse);
    } catch {
      // Config errors and source failures look the same to the reader.
      return json({ state: "unavailable" } satisfies PrivateResponse);
    }
  };
}
