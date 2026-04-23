import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3003";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { account } = await createSessionClient();
    const jwt = await account.createJWT();

    const response = await fetch(
      `${API_BASE_URL}/api/admin/recruitment/applications/${id}/resume`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
        },
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      return NextResponse.json(
        { error: payload?.error ?? "Failed to download resume" },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "Resume response was empty" },
        { status: 502 }
      );
    }

    const headers = new Headers();
    const contentDisposition = response.headers.get("content-disposition");
    const contentType = response.headers.get("content-type");

    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    headers.set("Cache-Control", "no-store");

    return new NextResponse(response.body, {
      headers,
      status: 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy resume download",
      },
      { status: 500 }
    );
  }
}
