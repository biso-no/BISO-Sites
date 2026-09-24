import { NextResponse } from "next/server";
import { fetchNotifications } from "@/lib/actions/notifications";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  try {
    const notifications = await fetchNotifications();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[api/notifications] Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
