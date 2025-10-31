import { ComponentConfig, Fields } from "@measured/puck";

// Core styling types
export interface SpacingValue {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
}

export interface Spacing {
  margin?: SpacingValue | string | number;
  padding?: SpacingValue | string | number;
}

export interface ColorValue {
  color?: string;
  opacity?: number;
}

export interface Colors {
  background?: ColorValue | string;
  text?: ColorValue | string;
  border?: ColorValue | string;
}

export interface Border {
  width?: string | number;
  radius?: string | number;
  style?: "solid" | "dashed" | "dotted" | "double" | "none";
  color?: string;
}

export interface Shadow {
  preset?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "inner" | "custom";
  custom?: string;
}

export interface Typography {
  fontSize?: string | number;
  fontWeight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
  lineHeight?: string | number;
  letterSpacing?: string | number;
  textAlign?: "left" | "center" | "right" | "justify";
}

export interface Layout {
  display?: "block" | "flex" | "grid" | "inline-block" | "inline-flex" | "hidden";
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  width?: string | number;
  height?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  overflow?: "visible" | "hidden" | "scroll" | "auto";
}

export interface ResponsiveValue<T> {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  "2xl"?: T;
}

// Component styling props that can be added to any component
export interface StyleProps {
  spacing?: Spacing;
  colors?: Colors;
  border?: Border;
  shadow?: Shadow;
  typography?: Typography;
  layout?: Layout;
  className?: string;
  customStyles?: React.CSSProperties;
}

// Preset system types
export interface StylePreset {
  name: string;
  label: string;
  description?: string;
  styles: Partial<StyleProps>;
}

export interface PresetGroup {
  name: string;
  presets: StylePreset[];
}

// Dynamic data types
export interface DataSource {
  type: "appwrite" | "api" | "static";
  config: AppwriteDataSource | ApiDataSource | StaticDataSource;
}

export interface AppwriteDataSource {
  databaseId: string;
  collectionId: string;
  queries?: string[];
}

export interface ApiDataSource {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

export interface StaticDataSource {
  data: any[];
}

export interface DataBinding {
  source: DataSource;
  mapping?: Record<string, string>;
  transform?: (data: any) => any;
}

// Enhanced Puck component config with our custom features
export interface EnhancedComponentConfig<
  Props extends Record<string, any> = any,
  DefaultProps = Partial<Props>
> {
  fields: Fields<Props>;
  render: (props: Props) => React.ReactElement;
  defaultProps?: DefaultProps;
  resolveData?: (props: Props) => Promise<any> | any;
  resolveFields?: (data: any, params: any) => Promise<Fields<Props>> | Fields<Props>;
  category?: string;
  icon?: React.ReactNode;
  previewImage?: string;
  dataBinding?: boolean;
}

// Editor state types
export interface EditorData {
  content: any[];
  root: {
    props?: Record<string, any>;
  };
  zones?: Record<string, any[]>;
}

// Collaboration types (for Yjs integration)
export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export interface Awareness {
  users: Map<number, User>;
  localUser: User;
}

