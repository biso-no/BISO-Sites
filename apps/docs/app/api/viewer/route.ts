import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const viewer = await getViewer();

  if (!viewer.signedIn) {
    return NextResponse.json(
      { signedIn: false, canSeePrivate: false },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      signedIn: true,
      name: viewer.name,
      canSeePrivate: viewer.access !== null,
    },
    { headers: NO_STORE }
  );
}
