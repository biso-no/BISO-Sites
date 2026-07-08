import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { users } = await createAdminClient();

    const start = Date.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        users.list([Query.limit(1)]),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Timeout")), 3000);
          timeout.unref?.();
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    return NextResponse.json(
      {
        status: "ready",
        latencyMs: Date.now() - start,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
