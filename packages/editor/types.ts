import type { Data, Metadata } from "@measured/puck";

// Query Builder types
export type QueryOperator =
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanEqual"
  | "greaterThan"
  | "greaterThanEqual"
  | "search"
  | "contains"
  | "isNull"
  | "isNotNull"
  | "between"
  | "startsWith"
  | "endsWith";

export type QueryCondition = {
  field: string;
  operator: QueryOperator;
  value?: string | number | boolean | null;
  values?: (string | number)[];  // For 'between' operator
};

export type QuerySort = {
  field: string;
  direction: "asc" | "desc";
};

export type QueryConfig = {
  conditions: QueryCondition[];
  logic?: "and" | "or";  // How to combine conditions
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
};

export type DataSourceType = "manual" | "database";

export type DataSourceConfig = {
  type: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;  // componentField -> dbField
};

export type CollectionField = {
  key: string;
  type: string;
  required: boolean;
  array?: boolean;
};

export type CollectionSchema = {
  $id: string;
  name: string;
  fields: CollectionField[];
};

// Common types
export type SectionBackground = "default" | "muted" | "primary";
export type SectionPadding = "none" | "sm" | "md" | "lg";
export type SectionWidth = "default" | "lg" | "xl" | "full";
export type ContentAlignment = "left" | "center" | "right";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type HeadingSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
export type TextSize = "sm" | "base" | "lg" | "xl";
export type TextTone = "default" | "muted";
export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

// Image types
export type ImageData = {
  type: "url" | "upload";
  url?: string;
  fileId?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type AspectRatio = "auto" | "square" | "video" | "wide" | "portrait";
export type ImageBorder = "none" | "sm" | "md" | "lg";
export type Shadow = "none" | "sm" | "md" | "lg" | "xl";

// Layout types
export type GridColumns = "1" | "2" | "3" | "4";
export type LayoutVariant = "centered" | "split" | "stacked";
export type IconPosition = "top" | "left";

// Gradient types
export type GradientPreset = "blue" | "purple" | "pink" | "cyan" | "green" | "orange" | "custom";

// Badge/Alert variants
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "glass-dark" | "gradient" | "gold" | "purple" | "green";
export type AlertVariant = "default" | "destructive";

export type PageBuilderRootProps = {
  // Visual settings
  background?: SectionBackground;
  width?: SectionWidth;
  spacing?: SectionPadding;
  
  // Translation-specific metadata (managed by admin)
  title?: string;
  description?: string;
  slug?: string;
};

export type SectionBlockProps = {
  id?: string;
  label?: string;
  background?: SectionBackground;
  gradient?: GradientPreset;
  backgroundImage?: ImageData;
  overlayOpacity?: number;
  padding?: SectionPadding;
  width?: SectionWidth;
  align?: ContentAlignment;
  border?: boolean;
  shadow?: Shadow;
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

// Block component types
export type HeroBlockProps = {
  id?: string;
  eyebrow?: string;
  heading: string;
  description?: string;
  backgroundImage?: ImageData;
  backgroundGradient?: GradientPreset;
  overlayOpacity?: number;
  primaryButtonLabel?: string;
  primaryButtonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
  align?: ContentAlignment;
  height?: "screen" | "large" | "medium";
};

export type StatItem = {
  id: string;
  icon?: string;
  number: string;
  label: string;
  gradient?: GradientPreset;
};

export type StatsBlockProps = {
  id?: string;
  stats: StatItem[];
  columns?: GridColumns;
  animated?: boolean;
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  statType?: "count" | "sum" | "average";
  valueField?: string;  // For sum/average
  query?: QueryConfig;
  label?: string;  // Label for the stat when using database mode
  icon?: string;  // Icon for the stat when using database mode
  gradient?: GradientPreset;  // Gradient for the stat when using database mode
};

export type FeatureItem = {
  id: string;
  icon?: string;
  title: string;
  description: string;
};

export type FeaturesBlockProps = {
  id?: string;
  features: FeatureItem[];
  columns?: GridColumns;
  iconPosition?: IconPosition;
  cardVariant?: "default" | "glass" | "gradient";
};

export type CTABlockProps = {
  id?: string;
  heading: string;
  description?: string;
  primaryButtonLabel?: string;
  primaryButtonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
  benefits?: string[];
  layout?: LayoutVariant;
  backgroundImage?: ImageData;
  backgroundGradient?: GradientPreset;
};

export type CardItem = {
  id: string;
  image?: ImageData;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
};

export type CardGridBlockProps = {
  id?: string;
  cards: CardItem[];
  columns?: GridColumns;
  cardVariant?: "default" | "glass" | "gradient" | "golden";
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type TestimonialBlockProps = {
  id?: string;
  quote: string;
  author: string;
  role?: string;
  avatar?: ImageData;
  rating?: number;
  background?: SectionBackground;
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export type FAQBlockProps = {
  id?: string;
  faqs: FAQItem[];
  heading?: string;
  description?: string;
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type LogoItem = {
  id: string;
  logo: ImageData;
  name: string;
  link?: string;
};

export type LogoCloudBlockProps = {
  id?: string;
  logos: LogoItem[];
  grayscale?: boolean;
  layout?: "grid" | "marquee";
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type PricingFeature = {
  id: string;
  text: string;
  included: boolean;
};

export type PricingTier = {
  id: string;
  name: string;
  price: string;
  period?: string;
  popular?: boolean;
  features: PricingFeature[];
  buttonLabel?: string;
  buttonHref?: string;
};

export type PricingTableBlockProps = {
  id?: string;
  tiers: PricingTier[];
  heading?: string;
  description?: string;
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type TeamMember = {
  id: string;
  photo?: ImageData;
  name: string;
  role: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  email?: string;
};

export type TeamGridBlockProps = {
  id?: string;
  members: TeamMember[];
  columns?: GridColumns;
  // Dynamic data source
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export type NewsletterBlockProps = {
  id?: string;
  heading: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
  privacyNotice?: string;
  background?: SectionBackground;
};

export type SpacerBlockProps = {
  id?: string;
  size?: SectionPadding;
  customHeight?: number;
};

export type ImageBlockProps = {
  id?: string;
  image: ImageData;
  caption?: string;
  aspectRatio?: AspectRatio;
  border?: ImageBorder;
  shadow?: Shadow;
  rounded?: boolean;
};

// Element component types
export type CardElementProps = {
  id?: string;
  variant?: "default" | "glass" | "glass-dark" | "gradient" | "gradient-border" | "animated" | "golden";
  content?: unknown;
};

export type BadgeElementProps = {
  id?: string;
  text: string;
  variant?: BadgeVariant;
};

export type AlertElementProps = {
  id?: string;
  title?: string;
  description: string;
  variant?: AlertVariant;
};

export type SeparatorElementProps = {
  id?: string;
  orientation?: "horizontal" | "vertical";
};

export type AvatarElementProps = {
  id?: string;
  image?: ImageData;
  fallback: string;
  size?: "sm" | "md" | "lg";
};

export type TabItem = {
  id: string;
  label: string;
  content: string;
};

export type TabsElementProps = {
  id?: string;
  tabs: TabItem[];
  defaultTab?: string;
};

export type AccordionItem = {
  id: string;
  title: string;
  content: string;
};

export type AccordionElementProps = {
  id?: string;
  items: AccordionItem[];
  type?: "single" | "multiple";
};

export type ProgressElementProps = {
  id?: string;
  value: number;
  max?: number;
  showLabel?: boolean;
};

export type SkeletonElementProps = {
  id?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
};

export type CheckboxElementProps = {
  id?: string;
  label: string;
  checked?: boolean;
};

export type InputElementProps = {
  id?: string;
  label?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number";
};

export type TextareaElementProps = {
  id?: string;
  label?: string;
  placeholder?: string;
  rows?: number;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectElementProps = {
  id?: string;
  label?: string;
  placeholder?: string;
  options: SelectOption[];
};

export type SwitchElementProps = {
  id?: string;
  label: string;
  checked?: boolean;
};

export type TableColumn = {
  id: string;
  header: string;
};

export type TableRow = {
  id: string;
  cells: string[];
};

export type TableElementProps = {
  id?: string;
  columns: TableColumn[];
  rows: TableRow[];
};

export type PageBuilderComponents = {
  // Layout
  Section: SectionBlockProps;
  
  // Content
  Heading: HeadingBlockProps;
  Text: TextBlockProps;
  Button: ButtonBlockProps;
  
  // Blocks
  Hero: HeroBlockProps;
  Stats: StatsBlockProps;
  Features: FeaturesBlockProps;
  CTA: CTABlockProps;
  CardGrid: CardGridBlockProps;
  Testimonial: TestimonialBlockProps;
  FAQ: FAQBlockProps;
  LogoCloud: LogoCloudBlockProps;
  PricingTable: PricingTableBlockProps;
  TeamGrid: TeamGridBlockProps;
  Newsletter: NewsletterBlockProps;
  Spacer: SpacerBlockProps;
  Image: ImageBlockProps;
  
  // Elements
  CardElement: CardElementProps;
  BadgeElement: BadgeElementProps;
  AlertElement: AlertElementProps;
  SeparatorElement: SeparatorElementProps;
  AvatarElement: AvatarElementProps;
  TabsElement: TabsElementProps;
  AccordionElement: AccordionElementProps;
  ProgressElement: ProgressElementProps;
  SkeletonElement: SkeletonElementProps;
  CheckboxElement: CheckboxElementProps;
  InputElement: InputElementProps;
  TextareaElement: TextareaElementProps;
  SelectElement: SelectElementProps;
  SwitchElement: SwitchElementProps;
  TableElement: TableElementProps;
};

export type PageBuilderDocument = Data<PageBuilderComponents, PageBuilderRootProps>;
export type PageBuilderMetadata = Metadata;
