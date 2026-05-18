"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const CAMPUS_CTX_COOKIE = "admin_campus_ctx";

export async function setCampusFilter(
  campusName: string | null
): Promise<void> {
  const jar = await cookies();
  if (campusName) {
    jar.set(CAMPUS_CTX_COOKIE, campusName, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  } else {
    jar.delete(CAMPUS_CTX_COOKIE);
  }
  revalidatePath("/", "layout");
}
