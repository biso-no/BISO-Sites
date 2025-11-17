import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { getStorageFileUrl } from "@repo/api/storage";
import type { HeroBlockProps, GradientPreset } from "../../types";

const heightMap = {
  screen: "h-screen",
  large: "h-[600px]",
  medium: "h-[400px]",
};

const alignmentMap = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const gradientMap: Record<GradientPreset, string> = {
  blue: "bg-linear-to-br from-blue-600 to-cyan-600",
  purple: "bg-linear-to-br from-purple-600 to-pink-600",
  pink: "bg-linear-to-br from-pink-600 to-rose-600",
  cyan: "bg-linear-to-br from-cyan-600 to-blue-600",
  green: "bg-linear-to-br from-green-600 to-emerald-600",
  orange: "bg-linear-to-br from-orange-600 to-red-600",
  custom: "bg-linear-to-br from-[#3DA9E0] to-[#001731]",
};

export function Hero({
  id,
  eyebrow,
  heading,
  description,
  backgroundImage,
  backgroundGradient = "custom",
  overlayOpacity = 60,
  primaryButtonLabel,
  primaryButtonHref = "#",
  secondaryButtonLabel,
  secondaryButtonHref = "#",
  align = "center",
  height = "screen",
}: HeroBlockProps) {
  const imageUrl = backgroundImage?.type === "upload" && backgroundImage.fileId
    ? getStorageFileUrl("content", backgroundImage.fileId)
    : backgroundImage?.url;

  return (
    <section id={id} className={cn("relative w-full overflow-hidden", heightMap[height])}>
      {/* Background */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={backgroundImage?.alt || "Hero background"}
              className="h-full w-full object-cover"
            />
            <div 
              className="absolute inset-0 bg-black"
              style={{ opacity: overlayOpacity / 100 }}
            />
          </>
        ) : (
          <div className={cn("h-full w-full", gradientMap[backgroundGradient])} />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className={cn("mx-auto max-w-5xl w-full flex flex-col gap-6", alignmentMap[align])}>
          {eyebrow && (
            <span className="inline-block rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 text-white/90">
              {eyebrow}
            </span>
          )}

          <h1 className="text-white font-bold text-4xl md:text-5xl lg:text-6xl">
            {heading}
          </h1>

          {description && (
            <p className="text-white/90 text-lg md:text-xl max-w-2xl">
              {description}
            </p>
          )}

          {(primaryButtonLabel || secondaryButtonLabel) && (
            <div className="flex flex-col sm:flex-row gap-4">
              {primaryButtonLabel && (
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-gray-900 hover:bg-gray-100"
                >
                  <a href={primaryButtonHref}>{primaryButtonLabel}</a>
                </Button>
              )}
              {secondaryButtonLabel && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20"
                >
                  <a href={secondaryButtonHref}>{secondaryButtonLabel}</a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

