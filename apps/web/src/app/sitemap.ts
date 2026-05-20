import type { MetadataRoute } from "next";
import { listJobs } from "@/app/actions/jobs";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/jobs`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/events`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE}/news`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  let jobRoutes: MetadataRoute.Sitemap = [];
  try {
    const jobs = await listJobs({ limit: 200 });
    jobRoutes = jobs.map((job) => ({
      url: `${BASE}/jobs/${job.slug}`,
      lastModified: new Date(job.$updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // If fetching jobs fails, return static routes only
  }

  return [...staticRoutes, ...jobRoutes];
}
