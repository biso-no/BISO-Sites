"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import Image, { ImageProps } from "next/image";
import { Button } from "@repo/ui/components/ui/button";
import { useTranslations } from "next-intl";

/**
 * Drop-in robust ImageWithFallback that does NOT force 100x100.
 * - Preserves caller-provided sizing props (fill | width/height | sizes)
 * - Falls back to a tiny inline SVG error asset if the primary src fails
 * - Sets unoptimized for data: URIs automatically
 */
const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4=";

export type ImageWithFallbackProps = ImageProps & {
  fallbackSrc?: string;
};

export function ImageWithFallback({ fallbackSrc = ERROR_IMG_SRC, onError, ...props }: ImageWithFallbackProps) {
  const [src, setSrc] = useState(props.src);
  const t = useTranslations('home.hero');
  const isDataUri = typeof src === "string" && src.startsWith("data:");

  return (
    <Image
      {...props}
      src={src}
      onError={(e) => {
        setSrc(fallbackSrc);
        onError?.(e);
      }}
      unoptimized={isDataUri}
      // allow callers to control priority/loading; provide sensible defaults below where used
    />
  );
}

// ---- Types for your content model ----
interface ContentRef { image?: string | null }
interface ContentTranslations {
  title?: string | null;
  description?: string | null;
  content_id?: string | number | null;
  event_ref?: ContentRef | null;
  news_ref?: ContentRef | null;
}

interface HeroCarouselProps {
  featuredContent: ContentTranslations[];
}

export function HeroCarousel({ featuredContent }: HeroCarouselProps) {
  const t = useTranslations('home.hero');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const scrollToContent = () => {
    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
  };

  const nextSlide = useCallback(() => {
    if (featuredContent.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % featuredContent.length);
  }, [featuredContent.length]);

  const prevSlide = () => {
    if (featuredContent.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + featuredContent.length) % featuredContent.length);
  };

  const goToSlide = (index: number) => setCurrentIndex(index);

  // Auto-rotate
  useEffect(() => {
    if (isPaused || featuredContent.length <= 1) return;
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, featuredContent.length]);

  // ---- Static fallback hero when no content ----
  if (!featuredContent || featuredContent.length === 0) {
    return (
      <div className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="/images/hero-bg.png"
            alt="Students at BI"
            fill
            sizes="100vw"
            className="object-cover"
            priority
            quality={85}
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8"
            >
              <Sparkles className="w-5 h-5 text-[#3DA9E0]" />
              <span className="text-white/90">BI Student Organisation</span>
            </motion.div>

            <motion.h1
              className="mb-6 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              {t('badge')}
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                {t('badgeElevated')}
              </span>
            </motion.h1>

            <motion.p
              className="mb-10 text-white/80 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              {t('subtitleDefault')}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
            >
              <Link href="#join">
                <Button size="lg" className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 px-8 py-6 shadow-2xl shadow-[#3DA9E0]/50">
                  <Users className="w-5 h-5 mr-2" />
                  {t('ctas.join')}
                </Button>
              </Link>
              <Link href="/events">
                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 px-8 py-6">
                  <Calendar className="w-5 h-5 mr-2" />
                  View Events
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.button
            onClick={scrollToContent}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChevronDown className="w-8 h-8 text-white/70" />
          </motion.button>
        </div>
      </div>
    );
  }

  // ---- Carousel rendering ----
  const currentItem = featuredContent[currentIndex];
  const isEvent = !!currentItem?.event_ref;
  const imageUrl = isEvent ? currentItem?.event_ref?.image : currentItem?.news_ref?.image;
  const contentLink = isEvent ? `/events/${currentItem?.content_id}` : `/news/${currentItem?.content_id}`;

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <ImageWithFallback
            src={imageUrl || "https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?w=2400"}
            alt={currentItem?.title || ""}
            fill
            sizes="100vw"
            className="object-cover"
            priority={currentIndex === 0}
            loading={currentIndex === 0 ? "eager" : "lazy"}
            decoding="async"
            quality={85}
            placeholder="empty"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
          <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 max-w-6xl mx-auto">
        <motion.div
          key={`content-${currentIndex}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
            <Sparkles className="w-5 h-5 text-[#3DA9E0]" />
            <span className="text-white/90">{t('featuredContent', { contentType: isEvent ? t('featuredEvent') : t('featuredNews') })}</span>
          </div>

          <h1 className="mb-6 text-white max-w-4xl mx-auto">{currentItem?.title || ""}</h1>

          <p className="mb-10 text-white/80 max-w-2xl mx-auto text-lg">
            {(currentItem?.description || "")
              .replace(/<[^>]+>/g, "")
              .slice(0, 180) || "..."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={contentLink}>
              <Button size="lg" className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 px-8 py-6 shadow-2xl shadow-[#3DA9E0]/50">
                {t('learnMore')}
              </Button>
            </Link>
            <Link href={isEvent ? "/events" : "/news"}>
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 px-8 py-6">
                {t('viewAll', { contentType: isEvent ? t('featuredEvent') : t('featuredNews') })}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Navigation arrows */}
        {featuredContent.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Dots navigation */}
        {featuredContent.length > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {featuredContent.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? "bg-white w-8" : "bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer z-20"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-8 h-8 text-white/70" />
        </motion.button>
      </div>
    </div>
  );
}
