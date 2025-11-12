import { createSessionClient } from "@repo/api/server";
import { ID } from '@repo/api'

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