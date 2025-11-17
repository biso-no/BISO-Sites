import { cn } from "@repo/ui/lib/utils";
import { getStorageFileUrl } from "@repo/api/storage";
import type { LogoCloudBlockProps } from "../../types";

export function LogoCloud({
  id,
  logos,
  grayscale = true,
  layout = "grid",
}: LogoCloudBlockProps) {
  if (layout === "marquee") {
    return (
      <div id={id} className="relative overflow-hidden">
        <div className="flex gap-12 animate-marquee">
          {[...logos, ...logos].map((logo, index) => {
            const logoUrl = logo.logo.type === "upload" && logo.logo.fileId
              ? getStorageFileUrl("content", logo.logo.fileId)
              : logo.logo.url;

            const content = (
              <img
                src={logoUrl}
                alt={logo.name}
                className={cn(
                  "h-12 w-auto object-contain transition-all",
                  grayscale && "grayscale hover:grayscale-0 opacity-60 hover:opacity-100"
                )}
              />
            );

            return logo.link ? (
              <a
                key={`${logo.id}-${index}`}
                href={logo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                {content}
              </a>
            ) : (
              <div key={`${logo.id}-${index}`} className="flex-shrink-0">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid layout
  return (
    <div
      id={id}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8 items-center justify-items-center"
    >
      {logos.map((logo) => {
        const logoUrl = logo.logo.type === "upload" && logo.logo.fileId
          ? getStorageFileUrl("content", logo.logo.fileId)
          : logo.logo.url;

        const content = (
          <img
            src={logoUrl}
            alt={logo.name}
            className={cn(
              "h-12 w-auto max-w-full object-contain transition-all",
              grayscale && "grayscale hover:grayscale-0 opacity-60 hover:opacity-100"
            )}
          />
        );

        return logo.link ? (
          <a
            key={logo.id}
            href={logo.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content}
          </a>
        ) : (
          <div key={logo.id}>{content}</div>
        );
      })}
    </div>
  );
}

