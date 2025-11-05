import { listEvents } from '@/app/actions/events';
import { listJobs } from '@/app/actions/jobs';
import { getLocale } from '@/app/actions/locale';
import { AboutClient } from './about-client';

export async function AboutSection() {
  const locale = await getLocale();
  
  // Fetch counts for events and jobs
  const [events, jobs] = await Promise.all([
    listEvents({ locale, status: 'published', limit: 1000 }),
    listJobs({ locale, status: 'published', limit: 1000 }),
  ]);

  return <AboutClient eventCount={events.length} jobCount={jobs.length} />;
}

