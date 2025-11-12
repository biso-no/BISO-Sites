"use server"
import { createSessionClient } from "@/lib/appwrite";
import { ID, Models, Query } from "node-appwrite";
import { revalidatePath } from "next/cache";
import { Campus } from "@/lib/types/post";


const databaseId = 'app';
const collectionId = 'campuses';

export async function getCampuses() {
    const { db } = await createSessionClient();
    const campuses = await db.listDocuments(
        'app',
        'campus',
        [Query.select(['name', '$id'])]
    );

    return campuses.documents as Campus[];
}