import type { Models } from "@repo/api";
import type { News } from "@repo/api/types/appwrite";

export interface Department extends Models.Row {
  Name: string;
}

export interface Campus extends Models.Row {
  name: string;
}

// Re-export News as Post for backwards compatibility
export type Post = News;
