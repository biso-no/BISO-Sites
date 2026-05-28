import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

const FUNCTION_ID =
  process.env.APPWRITE_CAMPUS_BOARD_FUNCTION_ID || "get_board_members";

interface ExecutionLike {
  response?: string;
  result?: string;
  status?: string;
  stdout?: string;
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const campus = payload?.campus ?? payload?.campusId ?? null;
  const departmentId = payload?.departmentId ?? null;

  if (!campus) {
    return NextResponse.json(
      { success: false, message: "Missing required parameter: campus" },
      { status: 400 }
    );
  }

  try {
    const { functions } = await createSessionClient();
    const execution = await functions.createExecution(
      FUNCTION_ID,
      JSON.stringify({ campus, departmentId })
    );

    const exec = execution as unknown as ExecutionLike;
    const raw = exec?.response ?? exec?.stdout ?? exec?.result ?? null;

    let parsed: Record<string, unknown> | null = null;
    if (raw && typeof raw === "string") {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch (_error) {
        parsed = null;
      }
    }

    const data = parsed ?? {
      success: exec?.status === "completed",
      response: raw,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load campus leadership", error);
    return NextResponse.json(
      { success: false, message: "Failed to load campus leadership" },
      { status: 500 }
    );
  }
}
