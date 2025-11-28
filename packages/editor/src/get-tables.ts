"use server";

export type TableOption = {
  label: string;
  value: string;
};

export async function getTables(): Promise<TableOption[]> {
  // Hardcoded for now, but could be fetched from Appwrite or config
  // If you want to fetch from Appwrite, you would need an Admin Client to list collections/databases
  // For now, we'll return the known collections as per the user request context (e.g. events, news)
  return [
    { label: "Events", value: "events" },
    { label: "News", value: "news" },
    { label: "Jobs", value: "jobs" },
    { label: "Partners", value: "partners" },
  ];
}
