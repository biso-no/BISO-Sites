import { ID } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { InputFile } from "@repo/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { account, storage } = await createSessionClient();
  const user = account.get();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blob = await request.blob();

  const file = await storage.createFile({
    bucketId: "content",
    fileId: ID.unique(),
    file: InputFile.fromBuffer(blob, "upload.bin"),
  });
  return NextResponse.json({ file });
}
