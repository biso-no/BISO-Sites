import { getMembershipStatus, refreshMembershipStatus } from "@/lib/actions/membership";
import { NextResponse } from "next/server";

/**
 * GET: Check user's membership status
 * Uses cached value if available, otherwise fetches from Finago
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    try {
        const status = forceRefresh
            ? await refreshMembershipStatus()
            : await getMembershipStatus();

        return NextResponse.json(status);
    } catch (error) {
        console.error("[Membership API] Error:", error);
        return NextResponse.json(
            { isMember: false, reason: "error", error: String(error) },
            { status: 500 }
        );
    }
}
