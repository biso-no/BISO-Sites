import type { ContentTranslations } from "@repo/api/types/appwrite";
import { listEvents } from "@/app/actions/events";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { HeroCarousel } from "./hero-carousel";

export async function HeroSection() {
  const locale = await getLocale();

  // Fetch featured events and news
  const [events, news] = await Promise.all([
    listEvents({ locale, status: "published", limit: 3 }),
    listNews({ locale, status: "published", limit: 2 }),
  ]);

  // Combine and shuffle for variety
  const featuredContent: ContentTranslations[] = [...events, ...news].slice(
    0,
    5
  );

  return <HeroCarousel featuredContent={featuredContent} />;
}
