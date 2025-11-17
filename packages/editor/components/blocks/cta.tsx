import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Check } from "lucide-react";
import { getStorageFileUrl } from "@repo/api/storage";
import type { CTABlockProps, GradientPreset } from "../../types";

const gradientMap: Record<GradientPreset, string> = {
  blue: "from-blue-600 to-cyan-600",
  purple: "from-purple-600 to-pink-600",
  pink: "from-pink-600 to-rose-600",
  cyan: "from-cyan-600 to-blue-600",
  green: "from-green-600 to-emerald-600",
  orange: "from-orange-600 to-red-600",
  custom: "from-[#3DA9E0] to-[#001731]",
};

export function CTA({
  id,
  heading,
  description,
  primaryButtonLabel,
  primaryButtonHref = "#",
  secondaryButtonLabel,
  secondaryButtonHref = "#",
  benefits = [],
  layout = "centered",
  backgroundImage,
  backgroundGradient = "custom",
}: CTABlockProps) {
  const imageUrl = backgroundImage?.type === "upload" && backgroundImage.fileId
    ? getStorageFileUrl("content", backgroundImage.fileId)
    : backgroundImage?.url;

  if (layout === "centered") {
    return (
      <Card
        id={id}
        className={cn(
          "relative overflow-hidden border-0 shadow-2xl p-12 text-center",
          imageUrl ? "text-white" : `bg-linear-to-br text-white ${gradientMap[backgroundGradient]}`
        )}
      >
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt={backgroundImage?.alt || "CTA background"}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        )}

        <div className="relative z-10 mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{heading}</h2>
          {description && <p className="text-lg mb-8 text-white/90">{description}</p>}

          {benefits.length > 0 && (
            <div className="mb-8 space-y-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{benefit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {primaryButtonLabel && (
              <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
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
        </div>
      </Card>
    );
  }

  // Split layout
  return (
    <Card
      id={id}
      className={cn(
        "relative overflow-hidden border-0 shadow-2xl",
        imageUrl ? "text-white" : `bg-linear-to-br text-white ${gradientMap[backgroundGradient]}`
      )}
    >
      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt={backgroundImage?.alt || "CTA background"}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}

      <div className="relative z-10 grid md:grid-cols-2 gap-12 p-12 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{heading}</h2>
          {description && <p className="text-lg text-white/90">{description}</p>}
        </div>

        <div>
          {benefits.length > 0 && (
            <div className="mb-8 space-y-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white">{benefit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {primaryButtonLabel && (
              <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100">
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
        </div>
      </div>
    </Card>
  );
}

