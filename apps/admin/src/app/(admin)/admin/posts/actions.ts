"use server"
import { createSessionClient } from "@repo/api/server";
import { Query } from "@repo/api";
import { Campus } from "@repo/api/types/appwrite";


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