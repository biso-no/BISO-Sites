"use client";

/**
 * Product cover thumbnail: the uploaded image when there is one, otherwise a
 * generated gradient + SVG pattern keyed off the product's `cover_pattern`.
 */

const PATTERN_GRADIENTS: Record<string, string> = {
  dotted: "linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%)",
  linear: "linear-gradient(135deg, #2a4a7a 0%, #15263c 100%)",
  concentric: "linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%)",
  wave: "linear-gradient(135deg, #b08a3e 0%, #6a5118 100%)",
  grid: "linear-gradient(180deg, #29261b 0%, #100e09 100%)",
};

function PatternSvg({ pattern }: { pattern: string }) {
  if (pattern === "dotted") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
      >
        <defs>
          <pattern
            height="10"
            id="shop-dash-dots"
            patternUnits="userSpaceOnUse"
            width="10"
          >
            <circle cx="2" cy="2" fill="white" r="1" />
          </pattern>
        </defs>
        <rect fill="url(#shop-dash-dots)" height="100%" width="100%" />
      </svg>
    );
  }
  if (pattern === "linear") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
      >
        <defs>
          <pattern
            height="8"
            id="shop-dash-linear"
            patternUnits="userSpaceOnUse"
            width="8"
          >
            <path
              d="M0 8L8 0"
              stroke="white"
              strokeLinecap="round"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect fill="url(#shop-dash-linear)" height="100%" width="100%" />
      </svg>
    );
  }
  if (pattern === "concentric") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
        viewBox="0 0 48 56"
      >
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="8"
          stroke="white"
          strokeWidth="0.8"
        />
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="16"
          stroke="white"
          strokeWidth="0.8"
        />
        <circle
          cx="24"
          cy="28"
          fill="none"
          r="24"
          stroke="white"
          strokeWidth="0.8"
        />
      </svg>
    );
  }
  if (pattern === "wave") {
    return (
      <svg
        aria-hidden="true"
        style={{
          bottom: 0,
          left: 0,
          opacity: 0.3,
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "100%",
        }}
        viewBox="0 0 48 56"
      >
        <path
          d="M0 14 C12 8, 24 20, 36 14 S48 8, 60 14"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
        <path
          d="M0 28 C12 22, 24 34, 36 28 S48 22, 60 28"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
        <path
          d="M0 42 C12 36, 24 48, 36 42 S48 36, 60 42"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
        />
      </svg>
    );
  }
  // grid
  return (
    <svg
      aria-hidden="true"
      style={{
        bottom: 0,
        left: 0,
        opacity: 0.3,
        position: "absolute",
        right: 0,
        top: 0,
        height: "100%",
        width: "100%",
      }}
    >
      <defs>
        <pattern
          height="10"
          id="shop-dash-grid"
          patternUnits="userSpaceOnUse"
          width="10"
        >
          <path
            d="M10 0L0 0L0 10"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect fill="url(#shop-dash-grid)" height="100%" width="100%" />
    </svg>
  );
}

export function CoverPatternThumbnail({
  image,
  pattern,
  size,
}: {
  image?: string | null;
  pattern?: string | null;
  size?: number;
}) {
  const w = size ?? 48;
  const h = size ?? 56;
  const pat = pattern ?? "dotted";
  const gradient = PATTERN_GRADIENTS[pat] ?? PATTERN_GRADIENTS.dotted;

  if (image) {
    return (
      <div
        style={{
          borderRadius: 8,
          flexShrink: 0,
          height: h,
          overflow: "hidden",
          width: w,
        }}
      >
        <img
          alt=""
          height={h}
          src={image}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
          width={w}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        background: gradient,
        borderRadius: 8,
        flexShrink: 0,
        height: h,
        overflow: "hidden",
        position: "relative",
        width: w,
      }}
    >
      <PatternSvg pattern={pat} />
    </div>
  );
}
