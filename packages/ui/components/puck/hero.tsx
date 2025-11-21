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
import Image from "next/image";
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

export interface HeroButton {
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
}

export interface HeroStat {
  value: string;
  label: string;
}

export interface HeroHighlight {
  icon?: string;
  text: string;
}

export interface HeroSlide {
  title: string;
  subtitle?: string;
  image?: string;
  buttons?: HeroButton[];
  content_id?: string;
  type?: "event" | "news" | "custom";
}

export interface HeroProps {
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
}

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
    if (slides.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = () => {
    if (slides.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (effectiveLayout !== "carousel" || isPaused || slides.length <= 1)
      return;
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
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0"
          >
            <ImageWithFallback
              src={
                currentSlide.image || backgroundImage || "/images/hero-bg.png"
              }
              alt={currentSlide.title || "Hero"}
              fill
              className="object-cover"
              priority={currentIndex === 0}
            />
            {showOverlay && (
              <>
                <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
                <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 container mx-auto">
          <motion.div
            key={`content-${currentIndex}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            {(badge || currentSlide.type) && (
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
                <Sparkles className="w-5 h-5 text-[#3DA9E0]" />
                <span className="text-white/90">
                  {badge ||
                    (currentSlide.type === "event"
                      ? "Featured Event"
                      : "Featured News")}
                </span>
              </div>
            )}

            <h1 className="mb-6 text-white text-4xl md:text-6xl font-bold">
              {currentSlide.title || title}
            </h1>

            {currentSlide.subtitle && (
              <p className="mb-10 text-white/80 max-w-2xl mx-auto text-lg">
                {currentSlide.subtitle}
              </p>
            )}

            {/* Buttons */}
            {(currentSlide.buttons?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-4 justify-center">
                {currentSlide.buttons?.map((btn, i) => (
                  <Button
                    key={i}
                    asChild
                    size="lg"
                    variant={
                      btn.variant === "glass"
                        ? "outline"
                        : (btn.variant as any) || "default"
                    }
                    className={cn(
                      btn.variant === "gradient" &&
                        "bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white border-0",
                      btn.variant === "glass" &&
                        "bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20"
                    )}
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
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all cursor-pointer",
                    idx === currentIndex ? "bg-white w-8" : "bg-white/40 w-2"
                  )}
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
        "relative flex flex-col justify-center overflow-hidden w-full",
        heightClasses[height]
      )}
    >
      {/* Background */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src={backgroundImage}
            alt="Hero background"
            fill
            className="object-cover"
            priority
          />
          {showOverlay && (
            <>
              <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
              <div className="absolute inset-0 bg-linear-to-t from-[#001731]/70 via-transparent to-transparent" />
            </>
          )}
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className={cn(
            "flex flex-col gap-8 max-w-4xl mx-auto",
            alignClasses[activeAlign],
            effectiveLayout === "split" &&
              "lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:max-w-7xl"
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-white/10 text-white backdrop-blur-md border border-white/20 self-start"
              >
                <MapPin className="w-3 h-3 mr-2" />
                {badge}
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className={cn(
                "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight",
                backgroundImage ? "text-white" : "text-foreground"
              )}
            >
              {title}
            </motion.h1>

            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className={cn(
                  "text-lg md:text-xl max-w-2xl",
                  backgroundImage ? "text-gray-200" : "text-muted-foreground"
                )}
              >
                {subtitle}
              </motion.p>
            )}

            {/* Highlights List */}
            {highlights.length > 0 && (
              <div
                className={cn(
                  "grid gap-3 my-2",
                  highlights.length > 2 ? "sm:grid-cols-2" : "grid-cols-1"
                )}
              >
                {highlights.map((item, idx) => {
                  const Icon = item.icon ? IconMap[item.icon] : Sparkles;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className={cn(
                        "flex items-center gap-2",
                        backgroundImage ? "text-white/90" : "text-foreground/80"
                      )}
                    >
                      <Icon className="w-4 h-4 text-[#3DA9E0]" />
                      <span>{item.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Buttons */}
            {buttons.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className={cn(
                  "flex flex-wrap gap-4 mt-2",
                  activeAlign === "center" && "justify-center"
                )}
              >
                {buttons.map((btn, i) => (
                  <Button
                    key={i}
                    asChild
                    size="lg"
                    variant={
                      btn.variant === "glass"
                        ? "outline"
                        : (btn.variant as any) || "default"
                    }
                    className={cn(
                      btn.variant === "gradient" &&
                        "bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white border-0",
                      btn.variant === "glass" &&
                        "bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20"
                    )}
                  >
                    <Link href={btn.href}>{btn.label}</Link>
                  </Button>
                ))}
              </motion.div>
            )}

            {/* Stats */}
            {stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className={cn(
                  "flex flex-wrap gap-3 mt-8",
                  activeAlign === "center" && "justify-center"
                )}
              >
                {stats.map((stat, idx) =>
                  statsVariant === "pills" ? (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left shadow-glow backdrop-blur-md"
                    >
                      <div className="text-xl font-semibold text-white">
                        {stat.value}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-white/70">
                        {stat.label}
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="text-center px-4">
                      <div className="text-3xl text-white mb-1 font-bold">
                        {stat.value}
                      </div>
                      <div className="text-white/80 text-sm">{stat.label}</div>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </div>

          {/* Right Slot or Image (Split Layout) */}
          {effectiveLayout === "split" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative w-full mt-8 lg:mt-0"
            >
              {rightSlot ? (
                <div className="w-full h-full">{rightSlot}</div>
              ) : image ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-2xl">
                  <ImageWithFallback
                    src={image}
                    alt={title || "Hero"}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Center/Left Layout Image (Bottom) */}
          {effectiveLayout !== "split" && image && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="relative w-full max-w-5xl mx-auto mt-12 aspect-video rounded-xl overflow-hidden shadow-2xl"
            >
              <ImageWithFallback
                src={image}
                alt={title || "Hero"}
                fill
                className="object-cover"
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
