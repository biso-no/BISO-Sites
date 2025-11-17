import type { PropsWithChildren } from "react";
import { cn } from "@repo/ui/lib/utils";
import { getStorageFileUrl } from "@repo/api/storage";
import type {
  ContentAlignment,
  SectionBackground,
  SectionPadding,
  SectionWidth,
  GradientPreset,
  ImageData,
  Shadow,
} from "../types";

const backgroundMap: Record<SectionBackground, string> = {
  default: "bg-white text-slate-900",
  muted: "bg-slate-100 text-slate-900",
  primary: "bg-primary text-primary-foreground",
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

const widthMap: Record<SectionWidth, string> = {
  default: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-none",
};

const paddingMap: Record<SectionPadding, string> = {
  none: "py-0",
  sm: "py-8",
  md: "py-12",
  lg: "py-16",
};

const alignmentMap: Record<ContentAlignment, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

const shadowMap: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

export interface SectionProps extends PropsWithChildren {
  background?: SectionBackground;
  gradient?: GradientPreset;
  backgroundImage?: ImageData;
  overlayOpacity?: number;
  width?: SectionWidth;
  padding?: SectionPadding;
  align?: ContentAlignment;
  border?: boolean;
  shadow?: Shadow;
  id?: string;
  className?: string;
  label?: string;
}

export function Section({
  background = "default",
  gradient,
  backgroundImage,
  overlayOpacity = 60,
  width = "default",
  padding = "md",
  align = "left",
  border = false,
  shadow = "none",
  id,
  children,
  className,
}: SectionProps) {
  const imageUrl = backgroundImage?.type === "upload" && backgroundImage.fileId
    ? getStorageFileUrl("content", backgroundImage.fileId)
    : backgroundImage?.url;

  const hasCustomBackground = !!gradient || !!imageUrl;

  return (
    <section
      id={id}
      className={cn(
        "w-full relative",
        !hasCustomBackground && backgroundMap[background],
        gradient && !imageUrl && gradientMap[gradient],
        gradient && !imageUrl && "text-white",
        paddingMap[padding],
        border && "border",
        shadowMap[shadow],
        className,
      )}
    >
      {/* Background Image */}
      {imageUrl && (
        <>
          <div className="absolute inset-0">
            <img
              src={imageUrl}
              alt={backgroundImage?.alt || "Section background"}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: overlayOpacity / 100 }}
            />
          </div>
          <div className="absolute inset-0 text-white" />
        </>
      )}

      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8",
          widthMap[width],
          alignmentMap[align],
          imageUrl && "relative z-10 text-white",
        )}
      >
        {children}
      </div>
    </section>
  );
}
