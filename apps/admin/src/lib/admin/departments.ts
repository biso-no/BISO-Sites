"use server";

import type { Departments } from "@repo/api/types/appwrite";

// Extended Department type with computed fields for display
export interface Department extends Omit<Departments, "Name"> {
  name: string;
  campusName?: string;
  userCount?: number;
}

// Re-export for compatibility
async function _getDepartmentTypes(): Promise<string[]> {
  // This is now handled in the page component
  return [];
}

async function _updateDepartment({ id, data }: { id: string; data: any }) {
  const { createSessionClient } = await import("@repo/api/server");
  const { db } = await createSessionClient();

  try {
    await db.updateRow("app", "departments", id, data);
    return { success: true };
  } catch (error) {
    console.error("Error updating department:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update department",
    };
  }
}
