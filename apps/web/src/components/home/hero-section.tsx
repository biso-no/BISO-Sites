import type { Events, News } from "@repo/api/types/appwrite";
import { HeroCarousel } from "./hero-carousel";

interface HeroSectionProps {
  campusName: string | null;
  events: Events[];
  news: News[];
}

// Data comes from the page (cached public readers) so the hero doesn't issue
// its own duplicate Appwrite queries per render.
export function HeroSection({ campusName, events, news }: HeroSectionProps) {
  const featuredContent: Array<Events | News> = [...events, ...news].slice(
    0,
    5
  );

  return (
    <HeroCarousel campusName={campusName} featuredContent={featuredContent} />
  );
}
