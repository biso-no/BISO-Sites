export const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
] as const;

export const SECTION_BG_OPTIONS = [
  { label: "White", value: "white" },
  { label: "Gray", value: "gray" },
  { label: "Primary (Light)", value: "primary" },
  { label: "Primary (Strong)", value: "primary-strong" },
  { label: "Dark", value: "dark" },
] as const;

export const PADDING_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
  { label: "Extra Large", value: "xl" },
] as const;

export const MAX_WIDTH_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Full", value: "full" },
  { label: "Narrow", value: "narrow" },
] as const;

export const HEADING_LEVEL_OPTIONS = [
  { label: "H1", value: 1 },
  { label: "H2", value: 2 },
  { label: "H3", value: 3 },
  { label: "H4", value: 4 },
] as const;

export const HEADING_SIZE_OPTIONS = [
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
  { label: "Extra Large", value: "xl" },
] as const;

export const TEXT_VARIANT_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Compact", value: "compact" },
  { label: "Lead", value: "lead" },
] as const;

export const TEXT_COLUMNS_OPTIONS = [
  { label: "1 Column", value: 1 },
  { label: "2 Columns", value: 2 },
] as const;

export const IMAGE_ASPECT_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "Video (16:9)", value: "video" },
  { label: "Square", value: "square" },
  { label: "Portrait (3:4)", value: "portrait" },
] as const;

export const IMAGE_ROUNDED_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
] as const;

export const BUTTON_SIZE_OPTIONS = [
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
] as const;

export const DIVIDER_STYLE_OPTIONS = [
  { label: "Line", value: "line" },
  { label: "Dashed", value: "dashed" },
  { label: "Dots", value: "dots" },
] as const;

export const DIVIDER_SPACING_OPTIONS = [
  { label: "Small", value: "sm" },
  { label: "Medium", value: "md" },
  { label: "Large", value: "lg" },
] as const;

export const GRADIENT_OPTIONS = [
  { label: "Brand", value: "from-[#3DA9E0] to-[#001731]" },
  { label: "Purple → Pink", value: "from-purple-600 to-pink-600" },
  { label: "Blue → Indigo", value: "from-blue-500 to-indigo-600" },
  { label: "Cyan → Blue", value: "from-cyan-500 to-blue-600" },
  { label: "Green → Emerald", value: "from-green-500 to-emerald-600" },
] as const;

export const ICON_VALUES = [
  "Sparkles",
  "Gift",
  "Crown",
  "Zap",
  "Check",
  "Calendar",
  "Briefcase",
  "Rocket",
  "Trophy",
  "Megaphone",
  "Link",
  "Users",
  "Globe",
  "BookOpen",
  "Building",
  "Heart",
  "MapPin",
  "CheckCircle",
  "ArrowRight",
] as const;

export type IconValue = (typeof ICON_VALUES)[number];

export const ICON_OPTIONS = [
  { label: "None", value: "" },
  ...ICON_VALUES.map((value) => ({ label: value, value })),
] as const;

export const BUTTON_VARIANT_VALUES = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "link",
  "glass",
  "glass-dark",
  "gradient",
  "glow",
] as const;

export type ButtonVariantValue = (typeof BUTTON_VARIANT_VALUES)[number];

export const BUTTON_VARIANT_OPTIONS = BUTTON_VARIANT_VALUES.map((value) => ({
  label: value,
  value,
})) as { label: string; value: ButtonVariantValue }[];
