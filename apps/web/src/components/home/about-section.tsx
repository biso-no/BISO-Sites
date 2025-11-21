import { getCampuses } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { AboutClient } from "./about-client";

export async function AboutSection() {
  const locale = await getLocale();

  // Fetch counts for events and jobs
  const [events, jobs, campuses] = await Promise.all([
    listEvents({ locale, status: "published", limit: 1000 }),
    listJobs({ locale, status: "published", limit: 1000 }),
    getCampuses({
      selectedCampusId: "all",
      includeDepartments: true,
      includeNational: false,
    }),
  ]);
  console.log("Campus data: ", campuses);
  const departments = campuses.reduce(
    (acc, campus) => acc + campus.departments.length,
    0
  );

  return (
    <AboutClient
      eventCount={events.length}
      jobCount={jobs.length}
      departmentsCount={departments}
    />
  );
}
