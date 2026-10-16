import { createAdminClient } from "@repo/api/server";
import {
  buildProfileRowPermissions,
  selfServiceProfileSchema,
} from "@repo/shared/utils/profile-fields";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

/**
 * Saves the caller's own profile from the app.
 *
 * Profile rows are read-only to their owner, so this is the app's only way to
 * change one. The body is cut down to the self-service allow-list — identity
 * columns such as `student_id` are dropped, never written — and the row is
 * updated, or created when absent, with the admin client.
 */
export async function PUT(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  let user: { $id: string; email: string; name: string };
  try {
    const { account } = await createAuthenticatedClient(req);
    user = await account.get();
  } catch {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  const parsed = selfServiceProfileSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return json(
      {
        success: false,
        error: "Invalid profile",
        issues: parsed.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join("."),
        })),
      },
      400
    );
  }
  const fields = parsed.data;

  try {
    const { db, users } = await createAdminClient();
    const existing = await db
      .getRow("app", "user", user.$id)
      .catch((error: unknown) => {
        if (isRowNotFound(error)) {
          return null;
        }
        throw error;
      });

    const profile = existing
      ? await db.updateRow("app", "user", user.$id, fields)
      : await db.createRow(
          "app",
          "user",
          user.$id,
          { ...fields, email: user.email },
          buildProfileRowPermissions(user.$id)
        );

    if (existing && fields.name && fields.name !== user.name) {
      await users
        .updateName({ name: fields.name, userId: user.$id })
        .catch((error: unknown) => {
          console.error("[profile] Could not mirror the account name:", error);
        });
    }

    return json({ success: true, profile });
  } catch (error) {
    console.error("[profile] Saving the profile failed:", error);
    return json({ success: false, error: "Failed to save profile" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
