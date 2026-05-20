import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";

const FUNCTION_ID =
  process.env.APPWRITE_CAMPUS_BOARD_FUNCTION_ID || "get_board_members";

interface CampusLeadershipPayload {
  campus?: string;
  campusId?: string;
  departmentId?: string;
}

interface FunctionExecutionResult {
  response?: string;
  result?: string;
  status?: string;
  stdout?: string;
}

export async function POST(request: Request) {
  let payload: CampusLeadershipPayload;

  try {
    payload = (await request.json()) as CampusLeadershipPayload;
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
    const execution = (await functions.createExecution(
      FUNCTION_ID,
      JSON.stringify({ campus, departmentId })
    )) as FunctionExecutionResult;

    const raw =
      execution.response || execution.stdout || execution.result || null;

    let parsed: unknown = null;
    if (raw && typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch (_error) {
        parsed = null;
      }
    }

    const data = parsed ?? {
      success: execution.status === "completed",
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
