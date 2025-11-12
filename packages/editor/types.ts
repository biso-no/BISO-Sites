import type { Data, Metadata } from "@measured/puck";

export type SectionBackground = "default" | "muted" | "primary";
export type SectionPadding = "none" | "sm" | "md" | "lg";
export type SectionWidth = "default" | "lg" | "xl" | "full";
export type ContentAlignment = "left" | "center";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type HeadingSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
export type TextSize = "sm" | "base" | "lg" | "xl";
export type TextTone = "default" | "muted";
export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export type PageBuilderRootProps = {
  background?: SectionBackground;
  width?: SectionWidth;
  spacing?: SectionPadding;
};

export type SectionBlockProps = {
  id?: string;
  label?: string;
  background?: SectionBackground;
  padding?: SectionPadding;
  width?: SectionWidth;
  align?: ContentAlignment;
  content?: unknown;
};

export type HeadingBlockProps = {
  id?: string;
  text: string;
  level: HeadingLevel;
  size: HeadingSize;
  align?: ContentAlignment;
  eyebrow?: string;
};

export type TextBlockProps = {
  id?: string;
  text: string;
  size?: TextSize;
  align?: ContentAlignment;
  tone?: TextTone;
};

export type ButtonBlockProps = {
  id?: string;
  label: string;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  newTab?: boolean;
  align?: ContentAlignment;
};

export type PageBuilderComponents = {
  Section: SectionBlockProps;
  Heading: HeadingBlockProps;
  Text: TextBlockProps;
  Button: ButtonBlockProps;
};

export type PageBuilderDocument = Data<PageBuilderComponents, PageBuilderRootProps>;
export type PageBuilderMetadata = Metadata;
