import type { SpacerBlockProps, SectionPadding } from "../../types";

const sizeMap: Record<SectionPadding, string> = {
  none: "h-0",
  sm: "h-8",
  md: "h-16",
  lg: "h-24",
};

export function Spacer({ id, size = "md", customHeight }: SpacerBlockProps) {
  if (customHeight) {
    return <div id={id} style={{ height: `${customHeight}px` }} />;
  }

  return <div id={id} className={sizeMap[size]} />;
}

