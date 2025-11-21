"use server"
import { ID, InputFile } from "@repo/api"
import { createSessionClient } from "@repo/api/server"

export async function uploadImage(file: File) {
    const { storage} = await createSessionClient()
    const result = await storage.createFile({
        bucketId: "content",
        fileId: ID.unique(),
        file: InputFile.fromBuffer(file, "test")
    })
    const url = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT + "/storage/buckets/content/files/" + result.$id + "/view?project=" + process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    return url
}
