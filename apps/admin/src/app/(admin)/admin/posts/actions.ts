"use server"
import { createSessionClient } from "@repo/api/server";
import { ID, Models, Query } from "node-appwrite";
import { revalidatePath } from "next/cache";
import { Campus } from "@/lib/types/post";


const databaseId = 'app';
const collectionId = 'campuses';

export async function getCampuses() {
    const { db } = await createSessionClient();
    const campuses = await db.listRows<Campus>(
        'app',
        'campuses',
        [Query.select(['name', '$id'])]
    );
    return campuses.rows;
}