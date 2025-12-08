"use client";
import { Button } from "@repo/ui/components/ui/button";
import type { CarouselApi } from "@repo/ui/components/ui/carousel";
import {
 Carousel,
 CarouselContent,
 CarouselItem,
 CarouselNext,
 CarouselPrevious,
} from "@repo/ui/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Calendar, ChevronDown, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Drop-in robust ImageWithFallback that does NOT force 100x100.
 * - Preserves caller-provided sizing props (fill | width/height | sizes)
 * - Falls back to a tiny inline SVG error asset if the primary src fails
 * - Sets unoptimized for data: URIs automatically
 */
const ERROR_IMG_SRC =
 "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4=";

type ImageWithFallbackProps = ImageProps & {
 fallbackSrc?: string;
};

function ImageWithFallback({
 fallbackSrc = ERROR_IMG_SRC,
 onError,
 ...props
}: ImageWithFallbackProps) {
 const [src, setSrc] = useState(props.src);
 const isDataUri = typeof src === "string" && src.startsWith("data:");

 return (
 <Image
 {...props}
 onError={(e) => {
 setSrc(fallbackSrc);
 onError?.(e);
 }}
 src={src}
 unoptimized={isDataUri}
 />
 );
}

// ---- Types for your content model ----
type ContentRef = {
 image?: string | null;
};
type ContentTranslations = {
 title?: string | null;
 description?: string | null;
 content_id?: string | number | null;
 event_ref?: ContentRef | null;
 news_ref?: ContentRef | null;
};

type HeroCarouselProps = {
 featuredContent: ContentTranslations[];
};

type HeroCarouselSlideProps = {
 index: number;
 item: ContentTranslations;
 t: ReturnType<typeof useTranslations>;
};

function HeroCarouselSlide({ index, item, t }: HeroCarouselSlideProps) {
 const isEvent = !!item?.event_ref;
 const imageUrl = isEvent ? item?.event_ref?.image : item?.news_ref?.image;
 const contentLink = isEvent
 ? `/events/${item?.content_id}`
 : `/news/${item?.content_id}`;

 return (
 <CarouselItem className="relative h-screen" key={index}>
 {/* Background Image */}
 <div className="absolute inset-0">
 <ImageWithFallback
 alt={item?.title || ""}
 className="object-cover"
 decoding="async"
 fill
 loading={index === 0 ? "eager" : "lazy"}
 placeholder="empty"
 priority={index === 0}
 quality={85}
 sizes="100vw"
 src={
 imageUrl ||
 "https://images.unsplash.com/photo-1758270704113-9fb2ac81788f?w=2400"
 }
 />
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />
 <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/70 via-transparent to-transparent" />
 </div>

 {/* Content */}
 <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-4">
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="text-center"
 initial={{ opacity: 0, y: 30 }}
 transition={{ duration: 0.8, delay: 0.2 }}
 >
 <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-background/10 px-6 py-3 backdrop-blur-md">
 <Sparkles className="h-5 w-5 text-brand" />
 <span className="text-white/90">
 {t("featuredContent", {
 contentType: isEvent ? t("featuredEvent") : t("featuredNews"),
 })}
 </span>
 </div>

 <h1 className="mx-auto mb-6 max-w-4xl text-white">
 {item?.title || ""}
 </h1>

 <p className="mx-auto mb-10 max-w-2xl text-lg text-white/80">
 {(item?.description || "").replace(/<[^>]+>/g, "").slice(0, 180) ||
 "..."}
 </p>

 <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
 <Link href={contentLink}>
 <Button
 className="border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-8 py-6 text-white shadow-2xl shadow-brand/50 hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
 size="lg"
 >
 {t("learnMore")}
 </Button>
 </Link>
 <Link href={isEvent ? "/events" : "/news"}>
 <Button
 className="border-white/30 bg-background/10 px-8 py-6 text-white backdrop-blur-md hover:bg-background/20"
 size="lg"
 variant="outline"
 >
 {t("viewAll", {
 contentType: isEvent ? t("featuredEvent") : t("featuredNews"),
 })}
 </Button>
 </Link>
 </div>
 </motion.div>
 </div>
 </CarouselItem>
 );
}

export function HeroCarousel({ featuredContent }: HeroCarouselProps) {
 const t = useTranslations("home.hero");
 const [api, setApi] = useState<CarouselApi>();
 const [current, setCurrent] = useState(0);

 const scrollToContent = () => {
 document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
 };

 // Track current slide
 useEffect(() => {
 if (!api) {
 return;
 }

 setCurrent(api.selectedScrollSnap());

 api.on("select", () => {
 setCurrent(api.selectedScrollSnap());
 });
 }, [api]);

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
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />
 <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/70 via-transparent to-transparent" />
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
 className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-background/10 px-6 py-3 backdrop-blur-md"
 initial={{ scale: 0 }}
 transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
 >
 <Sparkles className="h-5 w-5 text-brand" />
 <span className="text-white/90">BI Student Organisation</span>
 </motion.div>

 <motion.h1
 animate={{ opacity: 1, y: 0 }}
 className="mb-6 text-white"
 initial={{ opacity: 0, y: 20 }}
 transition={{ delay: 0.3, duration: 0.8 }}
 >
 {t("badge")}
 <br />
 <span className="bg-linear-to-r from-brand-gradient-from via-cyan-300 to-blue-300 bg-clip-text text-transparent">
 {t("badgeElevated")}
 </span>
 </motion.h1>

 <motion.p
 animate={{ opacity: 1 }}
 className="mx-auto mb-10 max-w-2xl text-white/80"
 initial={{ opacity: 0 }}
 transition={{ delay: 0.5, duration: 0.8 }}
 >
 {t("subtitleDefault")}
 </motion.p>

 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="flex flex-col items-center justify-center gap-4 sm:flex-row"
 initial={{ opacity: 0, y: 20 }}
 transition={{ delay: 0.7, duration: 0.8 }}
 >
 <Link href="#join">
 <Button
 className="border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to px-8 py-6 text-white shadow-2xl shadow-brand/50 hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
 size="lg"
 >
 <Users className="mr-2 h-5 w-5" />
 {t("ctas.join")}
 </Button>
 </Link>
 <Link href="/events">
 <Button
 className="border-white/30 bg-background/10 px-8 py-6 text-white backdrop-blur-md hover:bg-background/20"
 size="lg"
 variant="outline"
 >
 <Calendar className="mr-2 h-5 w-5" />
 {t("ctas.viewEvents")}
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
 return (
 <Carousel
 className="relative h-screen w-full overflow-hidden"
 opts={{
 loop: true,
 align: "start",
 }}
 plugins={[
 Autoplay({
 delay: 6000,
 stopOnInteraction: true,
 stopOnMouseEnter: true,
 }),
 ]}
 setApi={setApi}
 >
 <CarouselContent>
 {featuredContent.map((item, index) => (
 <HeroCarouselSlide index={index} item={item} key={index} t={t} />
 ))}
 </CarouselContent>

 {/* Navigation arrows - only show if more than 1 item */}
 {featuredContent.length > 1 && (
 <>
 <CarouselPrevious className="left-4 h-12 w-12 border-white/20 bg-background/10 backdrop-blur-md hover:bg-background/20" />
 <CarouselNext className="right-4 h-12 w-12 border-white/20 bg-background/10 backdrop-blur-md hover:bg-background/20" />
 </>
 )}

 {/* Dots navigation */}
 {featuredContent.length > 1 && (
 <div className="-translate-x-1/2 absolute bottom-24 left-1/2 z-20 flex gap-2">
 {featuredContent.map((_, index) => (
 <Button
 aria-label={`Go to slide ${index + 1}`}
 className={`h-2 w-2 rounded-full transition-all ${
 index === current
 ? "w-8 bg-background"
 : "bg-background/40 hover:bg-background/60"
 }`}
 key={index}
 onClick={() => api?.scrollTo(index)}
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
 </Carousel>
 );
}
