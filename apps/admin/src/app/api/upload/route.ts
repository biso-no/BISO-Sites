import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { InputFile } from "@repo/api/server";
import { ID } from "@repo/api";

export async function POST(request: Request) {
    const { account, storage } = await createSessionClient();
    const user = account.get();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const fileBuffer = await request.arrayBuffer();
    
    
    const file = await storage.createFile({
        bucketId: "content",
        fileId: ID.unique(),
        file: InputFile.fromBuffer(fileBuffer)
    });
    return NextResponse.json({ file });
}
