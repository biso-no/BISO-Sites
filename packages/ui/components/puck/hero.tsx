"use client";

import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Megaphone,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";
import { Button } from "../ui/button";

const IconMap: Record<string, any> = {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Briefcase,
  Trophy,
  Megaphone,
  CheckCircle,
  ArrowRight,
  Heart,
};

export type HeroButton = {
  label: string;
  href: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "glass"
    | "glass-dark"
    | "gradient"
    | "glow";
};

export type HeroStat = {
  value: string;
  label: string;
};

export type HeroHighlight = {
  icon?: string;
  text: string;
};

export type HeroSlide = {
  title: string;
  subtitle?: string;
  image?: string;
  buttons?: HeroButton[];
  content_id?: string;
  type?: "event" | "news" | "custom";
};

export type HeroProps = {
  layout?: "center" | "left" | "split" | "carousel";
  height?: "full" | "large" | "medium" | "small";
  backgroundImage?: string;
  backgroundColor?: string;
  overlay?: boolean;

  // Content for static layouts
  badge?: string;
  title?: string;
  subtitle?: string;
  buttons?: HeroButton[];
  image?: string; // For split layout or static bg

  // Content for carousel
  slides?: HeroSlide[];

  // Addons
  stats?: HeroStat[];
  highlights?: HeroHighlight[];
  statsVariant?: "pills" | "simple";

  // Slots
  rightSlot?: React.ReactNode;

  // Align
  align?: "left" | "center";

  // Legacy prop support
  type?: "center" | "left" | "split";
};

export function Hero({
  layout,
  type = "center",
  height = "medium",
  backgroundImage,
  overlay = true,
  badge,
  title,
  subtitle,
  buttons = [],
  image,
  slides = [],
  stats = [],
  highlights = [],
  statsVariant = "pills",
  rightSlot,
  align = "center",
}: HeroProps) {
  // Backwards compatibility for 'type'
  const effectiveLayout =
    layout ||
    (type === "center" || type === "left" || type === "split"
      ? type
      : "center");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Height classes
  const heightClasses = {
    full: "min-h-screen",
    large: "min-h-[70vh]",
    medium: "min-h-[50vh]",
    small: "min-h-[30vh]",
  };

  // Auto-rotate for carousel
  const nextSlide = useCallback(() => {
    if (slides.length === 0) {
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = () => {
    if (slides.length === 0) {
      return;
    }
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (effectiveLayout !== "carousel" || isPaused || slides.length <= 1) {
      return;
    }
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [effectiveLayout, isPaused, nextSlide, slides.length]);

  const showOverlay = overlay === true || String(overlay) === "true";

  // --- Render Carousel ---
  if (effectiveLayout === "carousel") {
    const currentSlide: HeroSlide = slides[currentIndex] || {
      title: "",
      subtitle: "",
    };

    return (
      <div
        className={cn("relative w-full overflow-hidden", heightClasses[height])}
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
              alt={currentSlide.title || "Hero"}
              className="object-cover"
              fill
              priority={currentIndex === 0}
              src={
                currentSlide.image || backgroundImage || "/images/hero-bg.png"
              }
            />
            {showOverlay && (
              <>
                <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
                <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="container relative z-10 mx-auto flex h-full flex-col items-center justify-center px-4">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-4xl text-center"
            initial={{ opacity: 0, y: 30 }}
            key={`content-${currentIndex}`}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Badge */}
            {(badge || currentSlide.type) && (
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-[#3DA9E0]" />
                <span className="text-white/90">
                  {badge ||
                    (currentSlide.type === "event"
                      ? "Featured Event"
                      : "Featured News")}
                </span>
              </div>
            )}

            <h1 className="mb-6 font-bold text-4xl text-white md:text-6xl">
              {currentSlide.title || title}
            </h1>

            {currentSlide.subtitle && (
              <p className="mx-auto mb-10 max-w-2xl text-lg text-white/80">
                {currentSlide.subtitle}
              </p>
            )}

            {/* Buttons */}
            {(currentSlide.buttons?.length || 0) > 0 && (
              <div className="flex flex-wrap justify-center gap-4">
                {currentSlide.buttons?.map((btn, i) => (
                  <Button
                    asChild
                    className={cn(
                      btn.variant === "gradient" &&
                        "border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white",
                      btn.variant === "glass" &&
                        "border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                    )}
                    key={i}
                    size="lg"
                    variant={
                      btn.variant === "glass"
                        ? "outline"
                        : (btn.variant as any) || "default"
                    }
                  >
                    <Link href={btn.href}>{btn.label}</Link>
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Navigation */}
        {slides.length > 1 && (
          <>
            <button
              className="-translate-y-1/2 absolute top-1/2 left-4 z-20 cursor-pointer rounded-full border border-white/20 bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/20"
              onClick={prevSlide}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="-translate-y-1/2 absolute top-1/2 right-4 z-20 cursor-pointer rounded-full border border-white/20 bg-white/10 p-3 text-white backdrop-blur-md hover:bg-white/20"
              onClick={nextSlide}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            {/* Dots */}
            <div className="-translate-x-1/2 absolute bottom-12 left-1/2 z-20 flex gap-2">
              {slides.map((_, idx) => (
                <button
                  className={cn(
                    "h-2 cursor-pointer rounded-full transition-all",
                    idx === currentIndex ? "w-8 bg-white" : "w-2 bg-white/40"
                  )}
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Static Layouts (Center, Left, Split) ---
  const alignClasses = {
    left: "text-left items-start",
    center: "text-center items-center",
  };
  // For split, default to left
  const activeAlign = effectiveLayout === "split" ? "left" : align;

  return (
    <div
      className={cn(
        "relative flex w-full flex-col justify-center overflow-hidden",
        heightClasses[height]
      )}
    >
      {/* Background */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            alt="Hero background"
            className="object-cover"
            fill
            priority
            src={backgroundImage}
          />
          {showOverlay && (
            <>
              <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
              <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
            </>
          )}
        </div>
      )}

      <div className="container relative z-10 mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div
          className={cn(
            "mx-auto flex max-w-4xl flex-col gap-8",
            alignClasses[activeAlign],
            effectiveLayout === "split" &&
              "lg:grid lg:max-w-7xl lg:grid-cols-2 lg:items-center lg:gap-16"
          )}
        >
          {/* Content Column */}
          <div
            className={cn(
              "flex flex-col gap-6",
              effectiveLayout === "split" && "lg:text-left"
            )}
          >
            {/* Badge */}
            {badge && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 font-medium text-sm text-white backdrop-blur-md"
                initial={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5 }}
              >
                <MapPin className="mr-2 h-3 w-3" />
                {badge}
              </motion.div>
            )}

            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "font-bold text-4xl tracking-tight md:text-5xl lg:text-6xl",
                backgroundImage ? "text-white" : "text-foreground"
              )}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {title}
            </motion.h1>

            {subtitle && (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "max-w-2xl text-lg md:text-xl",
                  backgroundImage ? "text-gray-200" : "text-muted-foreground"
                )}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {subtitle}
              </motion.p>
            )}

            {/* Highlights List */}
            {highlights.length > 0 && (
              <div
                className={cn(
                  "my-2 grid gap-3",
                  highlights.length > 2 ? "sm:grid-cols-2" : "grid-cols-1"
                )}
              >
                {highlights.map((item, idx) => {
                  const Icon = item.icon ? IconMap[item.icon] : Sparkles;
                  return (
                    <motion.div
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex items-center gap-2",
                        backgroundImage ? "text-white/90" : "text-foreground/80"
                      )}
                      initial={{ opacity: 0, x: -20 }}
                      key={idx}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                    >
                      <Icon className="h-4 w-4 text-[#3DA9E0]" />
                      <span>{item.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Buttons */}
            {buttons.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-2 flex flex-wrap gap-4",
                  activeAlign === "center" && "justify-center"
                )}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {buttons.map((btn, i) => (
                  <Button
                    asChild
                    className={cn(
                      btn.variant === "gradient" &&
                        "border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white",
                      btn.variant === "glass" &&
                        "border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                    )}
                    key={i}
                    size="lg"
                    variant={
                      btn.variant === "glass"
                        ? "outline"
                        : (btn.variant as any) || "default"
                    }
                  >
                    <Link href={btn.href}>{btn.label}</Link>
                  </Button>
                ))}
              </motion.div>
            )}

            {/* Stats */}
            {stats.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-8 flex flex-wrap gap-3",
                  activeAlign === "center" && "justify-center"
                )}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                {stats.map((stat, idx) =>
                  statsVariant === "pills" ? (
                    <div
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left shadow-glow backdrop-blur-md"
                      key={idx}
                    >
                      <div className="font-semibold text-white text-xl">
                        {stat.value}
                      </div>
                      <div className="text-white/70 text-xs uppercase tracking-wide">
                        {stat.label}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 text-center" key={idx}>
                      <div className="mb-1 font-bold text-3xl text-white">
                        {stat.value}
                      </div>
                      <div className="text-sm text-white/80">{stat.label}</div>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </div>

          {/* Right Slot or Image (Split Layout) */}
          {effectiveLayout === "split" && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="relative mt-8 w-full lg:mt-0"
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {rightSlot ? (
                <div className="h-full w-full">{rightSlot}</div>
              ) : image ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-2xl">
                  <ImageWithFallback
                    alt={title || "Hero"}
                    className="object-cover"
                    fill
                    src={image}
                  />
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Center/Left Layout Image (Bottom) */}
          {effectiveLayout !== "split" && image && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative mx-auto mt-12 aspect-video w-full max-w-5xl overflow-hidden rounded-xl shadow-2xl"
              initial={{ opacity: 0, y: 30 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <ImageWithFallback
                alt={title || "Hero"}
                className="object-cover"
                fill
                src={image}
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
