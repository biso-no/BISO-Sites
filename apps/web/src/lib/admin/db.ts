"use server"
import { Query } from "@repo/api/server";
import { createSessionClient } from "../appwrite";
import { Models } from "@repo/api/client"

export type User = {
  id: string
  email: string
  name: string
  campus: string
  isActive: boolean
  roles: string[]
}

export async function  convertDocumentToUser(doc: Models.Document){
  return {
    id: doc.$id,
    name: doc.name,
    email: doc.email,
    roles: doc.roles || [],
    isActive: doc.isActive,
    campus: doc.campus_id
  }
}

export async function convertDocumentsToUsers(docs:Models.DocumentList<Models.Document>){
  return docs.rows.map((doc: Models.Document) => ({
    id: doc.$id,
    name: doc.name,
    email: doc.email,
    roles: doc.roles || [],
    isActive: doc.isActive,
    campus: doc.campus_id
  }))
}

export async function getPages() {
  const { db } = await createSessionClient();

  return db.listRows("webapp", "page_content", [
    Query.limit(100),
    Query.select(["title", "path", "$id", "$createdAt"]),
  ]);
}

export async function deletePage(pageId: string) {
  const { db } = await createSessionClient();

  return db.deleteDocument("webapp", "page_content", pageId);
}

export async function getProfile(userId: string) {
  const { db } = await createSessionClient();

  return db.getDocument("webapp", "profile", userId);
}

//users
export async function getUsers() {
  const { db } = await createSessionClient();
  return db.listRows("app", "user", [
    Query.limit(1000),
    Query.select(["$id", "name", "email","roles","campus_id", "isActive"]),
  ]);
}
 //get one user
export async function getUser(userId: string) {
  const { db } = await createSessionClient();
  return db.getDocument("app", "user", userId);
}

export async function updateUser(userId: string, userInformation: User) {
  const { db } = await createSessionClient();
  return db.updateDocument(
    'app', // databaseId
    'user', // collectionId
    userId, // documentId
    {
      "email": userInformation.email,
      "name": userInformation.name,
      "campus_id": userInformation.campus,
      "isActive": userInformation.isActive,
      "roles": userInformation.roles
    }, // data (optional)
  )
}

export async function getCampuses() {
  const { db } = await createSessionClient();
  const campuses = await db.listRows("app", "campus", [
    Query.limit(100),
    Query.select(["$id", "name"]),
  ]);
  
  return campuses.rows.map((campus) => ({
    id: campus.$id,
    name: campus.name,
  }));
}