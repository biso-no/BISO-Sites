import { Plus } from "lucide-react";
import { requireNavAccess } from "@/lib/authorization";
import { listAnnouncements } from "../_actions/announcements";
import { PageHeader } from "../_components/page-header";
import { StudioLinkButton } from "../_components/studio";
import { AnnouncementListClient } from "./_components/announcement-list-client";
import { parseSourceFilter } from "./_components/source-filter";

interface CommunicationsPageProps {
  searchParams: Promise<{ page?: string; source?: string }>;
}

export default async function CommunicationsPage({
  searchParams,
}: CommunicationsPageProps) {
  await requireNavAccess("portal.communications");
  const { page: pageParam, source: sourceParam } = await searchParams;
  const source = parseSourceFilter(sourceParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const announcements = await listAnnouncements({ page, source });

  return (
    <div className="pb-12">
      <PageHeader
        description="Send push notifications and in-app messages to the BISO mobile app."
        title="Communications"
      >
        <StudioLinkButton href="/communications/new" variant="primary">
          <Plus size={15} />
          New announcement
        </StudioLinkButton>
      </PageHeader>

      <AnnouncementListClient
        initialAnnouncements={announcements.rows}
        page={page}
        segmentNames={announcements.segmentNames}
        source={source}
        total={announcements.total}
      />
    </div>
  );
}
