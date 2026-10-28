import type { Viewer } from "@/lib/auth/viewer";
import {
  isServableName,
  MAX_PRIVATE_NAMES,
  type PrivateName,
} from "./registry";
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

/**
 * The requested names, or `null` (a 400) when there are none, too many, or any
 * is unknown or kit-only. Kit-only names are never served: the emergency kit
 * is kept offline.
 */
export function parseNames(
  raw: string,
  max = MAX_PRIVATE_NAMES,
  isKnown: (name: string) => boolean = isServableName
): PrivateName[] | null {
  const names = [
    ...new Set(
      raw
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0 || names.length > max) {
    return null;
  }
  return names.every(isKnown) ? (names as PrivateName[]) : null;
}

async function readValues(
  names: PrivateName[],
  getSource: PrivateHandlerDeps["getSource"]
): Promise<PrivateResponse> {
  const source = getSource();
  if (!source) {
    return { state: "unavailable" };
  }
  const found = await source.get(names);
  const values: Partial<Record<PrivateName, string>> = {};
  const missing: PrivateName[] = [];
  for (const name of names) {
    const value = found[name];
    if (typeof value === "string") {
      values[name] = value;
    } else {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    // Names only, never values: lets owner QA tell a missing key from an
    // outage, which shows up as "unavailable" instead.
    console.warn(
      `[docs] private source has no value for: ${missing.join(", ")}`
    );
  }
  return { state: "ok", values };
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
    const names = parseNames(
      new URL(request.url).searchParams.get("names") ?? ""
    );
    if (!names) {
      return json({ error: "Invalid names" }, 400);
    }

    let viewer: Viewer;
    try {
      viewer = await getViewer();
    } catch {
      return json({ state: "unavailable" } satisfies PrivateResponse);
    }
    if (!viewer.signedIn) {
      return json({ state: "signed-out" } satisfies PrivateResponse);
    }
    if (viewer.access === null) {
      return json({ state: "forbidden" } satisfies PrivateResponse);
    }

    try {
      return json(await readValues(names, getSource));
    } catch (error) {
      // Config errors and source failures look the same to the reader. Log the
      // name and message only: never values or tokens.
      console.error(
        "[docs] private source unavailable:",
        error instanceof Error ? `${error.name}: ${error.message}` : "unknown"
      );
      return json({ state: "unavailable" } satisfies PrivateResponse);
    }
  };
}
