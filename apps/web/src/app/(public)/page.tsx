import { Suspense } from "react";
import { AboutSection } from "@/components/home/about-section";
import { EventsSection } from "@/components/home/events-section";
import { HeroSection } from "@/components/home/hero-section";
import { JoinUs } from "@/components/home/join-us";
import { NewsSection } from "@/components/home/news-section";
import {
  AboutSkeleton,
  EventsSkeleton,
  HeroSkeleton,
  NewsSkeleton,
} from "@/components/home/skeletons";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<AboutSkeleton />}>
        <AboutSection />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsSection />
      </Suspense>

      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection />
      </Suspense>

      <JoinUs />
    </div>
  );
}
