import { createSessionClient } from "@repo/api/server";
import { ID } from '@repo/api'
import { Departments } from "@repo/api/types/appwrite";

export async function uploadUnitLogo(file: File) {
  try {
    const { storage } = await createSessionClient();
    const uploadedFile = await storage.createFile(
      'expenses', 
      ID.unique(),
      file
    );
    return uploadedFile.$id;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function updateDepartment(department: Departments) {
  const { db } = await createSessionClient();
  const response = await db.updateRow('app', 'departments', department.$id, department);
  return response;
}

export async function createDepartment(department: Departments) {
  const { db } = await createSessionClient();
  const response = await db.createRow('app', 'departments', department.Id, department);
  return response;
}

