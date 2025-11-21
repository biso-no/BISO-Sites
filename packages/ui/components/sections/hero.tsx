"use client";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImageWithFallback } from "../image";
import { Button } from "../ui/button";

export type HeroContentItem = {
  title?: string | null;
  description?: string | null;
  content_id?: string | number | null;
  imageUrl?: string | null;
  link?: string;
  type?: "event" | "news" | "custom";
};

export type HeroProps = {
  featuredContent: HeroContentItem[];
  labels: {
    badge: string;
    badgeElevated: string;
    subtitle: string;
    ctaJoin: string;
    ctaViewEvents: string;
    featuredLabel: string;
    learnMore: string;
    viewAll: string;
  };
};

export function Hero({ featuredContent, labels }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const scrollToContent = () => {
    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
  };

  const nextSlide = useCallback(() => {
    if (featuredContent.length === 0) {
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % featuredContent.length);
  }, [featuredContent.length]);

  const prevSlide = () => {
    if (featuredContent.length === 0) {
      return;
    }
    setCurrentIndex(
      (prev) => (prev - 1 + featuredContent.length) % featuredContent.length
    );
  };

  const goToSlide = (index: number) => setCurrentIndex(index);

  // Auto-rotate
  useEffect(() => {
    if (isPaused || featuredContent.length <= 1) {
      return;
    }
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, featuredContent.length]);

  // ---- Static fallback hero when no content ----
  if (!featuredContent || featuredContent.length === 0) {
    return (
      <div className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            alt="Students at BI"
            className="object-cover"
            fill
            priority
            quality={85}
            sizes="100vw"
            src="/images/hero-bg.png"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-4">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              animate={{ scale: 1 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-md"
              initial={{ scale: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Sparkles className="h-5 w-5 text-[#3DA9E0]" />
              <span className="text-white/90">BI Student Organisation</span>
            </motion.div>

            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 text-white"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              {labels.badge}
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                {labels.badgeElevated}
              </span>
            </motion.h1>

            <motion.p
              animate={{ opacity: 1 }}
              className="mx-auto mb-10 max-w-2xl text-white/80"
              initial={{ opacity: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              {labels.subtitle}
            </motion.p>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.7, duration: 0.8 }}
            >
              <Link href="#join">
                <Button
                  className="border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] px-8 py-6 text-white shadow-2xl shadow-[#3DA9E0]/50 hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
                  size="lg"
                >
                  <Users className="mr-2 h-5 w-5" />
                  {labels.ctaJoin}
                </Button>
              </Link>
              <Link href="/events">
                <Button
                  className="border-white/30 bg-white/10 px-8 py-6 text-white backdrop-blur-md hover:bg-white/20"
                  size="lg"
                  variant="outline"
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  {labels.ctaViewEvents}
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.button
            animate={{ y: [0, 10, 0] }}
            className="-translate-x-1/2 absolute bottom-8 left-1/2 cursor-pointer"
            onClick={scrollToContent}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          >
            <ChevronDown className="h-8 w-8 text-white/70" />
          </motion.button>
        </div>
      </div>
    );
  }

  // ---- Carousel rendering ----
  const currentItem = featuredContent[currentIndex];
  // Use provided link or fallback based on content_id and type
  const contentLink =
    currentItem?.link ||
    (currentItem?.type === "event"
      ? `/events/${currentItem?.content_id}`
      : `/news/${currentItem?.content_id}`);

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={currentIndex}
          transition={{ duration: 0.7 }}
        >
          <ImageWithFallback
            alt={currentItem?.title || ""}
            className="object-cover"
            decoding="async"
            fill
            loading={currentIndex === 0 ? "eager" : "lazy"}
            placeholder="empty"
            priority={currentIndex === 0}
            quality={85}
            sizes="100vw"
            src={
              currentItem?.imageUrl ||
              "https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?w=2400"
            }
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-4">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          key={`content-${currentIndex}`}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="mb-8 inline-block items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-md">
            <Sparkles className="mr-2 inline h-5 w-5 text-[#3DA9E0]" />
            <span className="text-white/90">{labels.featuredLabel}</span>
          </div>

          <h1 className="mx-auto mb-6 max-w-4xl font-bold text-4xl text-white md:text-6xl">
            {currentItem?.title || ""}
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-white/80">
            {(currentItem?.description || "")
              .replace(/<[^>]+>/g, "")
              .slice(0, 180) || "..."}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={contentLink}>
              <Button
                className="border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] px-8 py-6 text-white shadow-2xl shadow-[#3DA9E0]/50 hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
                size="lg"
              >
                {labels.learnMore}
              </Button>
            </Link>
            <Link href={currentItem?.type === "event" ? "/events" : "/news"}>
              <Button
                className="border-white/30 bg-white/10 px-8 py-6 text-white backdrop-blur-md hover:bg-white/20"
                size="lg"
                variant="outline"
              >
                {labels.viewAll}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Navigation arrows */}
        {featuredContent.length > 1 && (
          <>
            <button
              aria-label="Previous slide"
              className="-translate-y-1/2 absolute top-1/2 left-4 z-20 cursor-pointer rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md transition-colors hover:bg-white/20"
              onClick={prevSlide}
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              aria-label="Next slide"
              className="-translate-y-1/2 absolute top-1/2 right-4 z-20 cursor-pointer rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md transition-colors hover:bg-white/20"
              onClick={nextSlide}
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </>
        )}

        {/* Dots navigation */}
        {featuredContent.length > 1 && (
          <div className="-translate-x-1/2 absolute bottom-24 left-1/2 z-20 flex gap-2">
            {featuredContent.map((_, index) => (
              <button
                aria-label={`Go to slide ${index + 1}`}
                className={`h-2 w-2 cursor-pointer rounded-full transition-all ${
                  index === currentIndex
                    ? "w-8 bg-white"
                    : "bg-white/40 hover:bg-white/60"
                }`}
                key={index}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <motion.button
          animate={{ y: [0, 10, 0] }}
          className="-translate-x-1/2 absolute bottom-8 left-1/2 z-20 cursor-pointer"
          onClick={scrollToContent}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <ChevronDown className="h-8 w-8 text-white/70" />
        </motion.button>
      </div>
    </div>
  );
}
