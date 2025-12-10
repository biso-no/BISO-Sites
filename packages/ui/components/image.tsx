"use client";
import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4=";

type Props = ImageProps & {
  fallbackSrc?: string;
};

export function ImageWithFallback({
  fallbackSrc = ERROR_IMG_SRC,
  onError,
  ...props
}: Props) {
  const [src, setSrc] = useState(props.src);

  // Sync internal state when props.src changes
  useEffect(() => {
    setSrc(props.src);
  }, [props.src]);

  return (
    <Image
      {...props}
      // never force 100x100; use what caller provided
      onError={(e) => {
        setSrc(fallbackSrc);
        onError?.(e);
      }}
      src={src}
      // data: URIs and some CDNs don’t benefit from Next optimization
      unoptimized={typeof src === "string" && src.startsWith("data:")}
    />
  );
}
