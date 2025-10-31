import { Client, Databases, ID } from "@repo/api/server";
import fetch from "node-fetch";
import { z } from "zod";

// --- CONFIG ---
const WP_API_URL = "https://biso.no/wp-json/custom/v1/jobs";
const APPWRITE_ENDPOINT = "https://appwrite.biso.no/v1";
const APPWRITE_PROJECT = "biso";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = "app";
const COLLECTION_ID = "jobs";

// --- INIT APPWRITE ---
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

// --- TYPES FROM WP ---
type WPJob = {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  campus: string[];
  department: string[];
  verv: string[];
  url: string;
  date_posted: string;
  date_modified: string;
  expiry_date: string | null;
  is_expired: boolean;
  location: string | null;
  job_type: string | null;
  salary_range: string | null;
  application_deadline: string | null;
  is_featured: boolean;
  thumbnail: {
    id: number;
    url: string;
    width: number;
    height: number;
  } | null;
};

// --- ZOD SCHEMA FOR APPWRITE ---
const JobSchema = z.object({
  title: z.string(),
  slug: z.string(),
  campus: z.string(),
  department_id: z.string(),
  status: z.enum(["active", "expired"]),
  type: z.string(),
  duration_months: z.number().int(),
  application_deadline: z.string().datetime().nullable(),
  start_date: z.string().datetime().nullable(),
  end_date: z.string().datetime().nullable(),
  contact_name: z.string().nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().nullable(),
  interests: z.array(z.string()),
  apply_url: z.string().url(),
  image: z.string().url().nullable(),
  description: z.string(),
});

// --- HELPERS ---
function mapWpJobToAppwrite(job: WPJob) {
  // Right now, WP doesn’t provide contact info, so we fake them
  // Later you can pull from custom meta fields
  const email = `job-${job.id}@example.com`;

  return {
    title: job.title,
    slug: job.slug,
    campus: job.campus[0] || "",
    department_id: job.department[0] || "",
    status: job.is_expired ? "expired" : "active",
    type: job.job_type || "unspecified",
    duration_months: 0,
    application_deadline: job.application_deadline
      ? new Date(job.application_deadline).toISOString()
      : null,
    start_date: null,
    end_date: job.expiry_date ? new Date(job.expiry_date).toISOString() : null,
    contact_name: null,
    contact_email: email, // ✅ always set an email
    contact_phone: null,
    interests: job.department,
    apply_url: job.url,
    image: job.thumbnail?.url || null,
    description: job.content || job.excerpt,
  };
}

// --- MAIN ---
async function importJobs() {
  console.log("Fetching jobs from WordPress...");
  const res = await fetch(WP_API_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.statusText}`);
  }

  const data = await res.json();
  const jobs: WPJob[] = data.jobs;

  console.log(`Found ${jobs.length} jobs, importing to Appwrite...`);

  for (const job of jobs) {
    const mapped = mapWpJobToAppwrite(job);

    const parsed = JobSchema.safeParse(mapped);
    if (!parsed.success) {
      console.error(
        `❌ Validation failed for job "${job.title}" (ID ${job.id}):`,
        parsed.error.format()
      );
      continue;
    }

    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        parsed.data
      );
      console.log(`✅ Imported job: ${job.title}`);
    } catch (err: any) {
      console.error(`❌ Failed to import job "${job.title}":`, err.message);
    }
  }

  console.log("🎉 Import completed.");
}

importJobs().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
