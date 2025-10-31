import { StylePreset, PresetGroup } from "../types";

/**
 * Preset style configurations for common use cases
 */

// Button presets
export const buttonPresets: StylePreset[] = [
  {
    name: "default",
    label: "Default",
    description: "Standard button style",
    styles: {},
  },
  {
    name: "hero-cta",
    label: "Hero CTA",
    description: "Large call-to-action button for hero sections",
    styles: {
      spacing: {
        padding: { top: "16px", right: "32px", bottom: "16px", left: "32px" },
      },
      typography: {
        fontSize: "lg",
        fontWeight: "semibold",
      },
      border: {
        radius: "lg",
      },
      shadow: {
        preset: "lg",
      },
    },
  },
  {
    name: "outline",
    label: "Outline",
    description: "Subtle outline button",
    styles: {
      border: {
        width: "2",
        style: "solid",
      },
      shadow: {
        preset: "none",
      },
    },
  },
];

// Card presets
export const cardPresets: StylePreset[] = [
  {
    name: "default",
    label: "Default",
    description: "Standard card style",
    styles: {
      border: {
        width: "1",
        radius: "lg",
      },
      shadow: {
        preset: "md",
      },
      spacing: {
        padding: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      },
    },
  },
  {
    name: "elevated",
    label: "Elevated",
    description: "Card with prominent shadow",
    styles: {
      border: {
        width: "0",
        radius: "xl",
      },
      shadow: {
        preset: "2xl",
      },
      spacing: {
        padding: { top: "32px", right: "32px", bottom: "32px", left: "32px" },
      },
    },
  },
  {
    name: "flat",
    label: "Flat",
    description: "Minimal card without shadow",
    styles: {
      border: {
        width: "1",
        radius: "md",
      },
      shadow: {
        preset: "none",
      },
      spacing: {
        padding: { top: "16px", right: "16px", bottom: "16px", left: "16px" },
      },
    },
  },
  {
    name: "glass",
    label: "Glassmorphism",
    description: "Modern glass effect",
    styles: {
      border: {
        width: "1",
        radius: "2xl",
      },
      shadow: {
        preset: "xl",
      },
      spacing: {
        padding: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      },
    },
  },
];

// Section presets
export const sectionPresets: StylePreset[] = [
  {
    name: "default",
    label: "Default",
    description: "Standard section spacing",
    styles: {
      spacing: {
        padding: { top: "64px", bottom: "64px" },
      },
    },
  },
  {
    name: "hero",
    label: "Hero",
    description: "Large spacing for hero sections",
    styles: {
      spacing: {
        padding: { top: "96px", bottom: "96px" },
      },
      typography: {
        textAlign: "center",
      },
    },
  },
  {
    name: "compact",
    label: "Compact",
    description: "Reduced spacing",
    styles: {
      spacing: {
        padding: { top: "32px", bottom: "32px" },
      },
    },
  },
  {
    name: "feature",
    label: "Feature Section",
    description: "Feature showcase section",
    styles: {
      spacing: {
        padding: { top: "80px", bottom: "80px" },
      },
    },
  },
];

// Hero presets
export const heroPresets: StylePreset[] = [
  {
    name: "centered",
    label: "Centered",
    description: "Content centered with large spacing",
    styles: {
      spacing: {
        padding: { top: "120px", bottom: "120px" },
      },
      typography: {
        textAlign: "center",
      },
    },
  },
  {
    name: "split",
    label: "Split",
    description: "Content aligned to left with image on right",
    styles: {
      spacing: {
        padding: { top: "80px", bottom: "80px" },
      },
      typography: {
        textAlign: "left",
      },
    },
  },
  {
    name: "fullscreen",
    label: "Fullscreen",
    description: "Full viewport height hero",
    styles: {
      layout: {
        height: "100vh",
      },
      typography: {
        textAlign: "center",
      },
    },
  },
];

// All preset groups
export const presetGroups: PresetGroup[] = [
  {
    name: "Button",
    presets: buttonPresets,
  },
  {
    name: "Card",
    presets: cardPresets,
  },
  {
    name: "Section",
    presets: sectionPresets,
  },
  {
    name: "Hero",
    presets: heroPresets,
  },
];

/**
 * Get presets for a specific component type
 */
export function getPresetsForComponent(componentType: string): StylePreset[] {
  const group = presetGroups.find(
    (g) => g.name.toLowerCase() === componentType.toLowerCase()
  );
  return group?.presets || [];
}

/**
 * Get a specific preset by component type and preset name
 */
export function getPreset(componentType: string, presetName: string): StylePreset | undefined {
  const presets = getPresetsForComponent(componentType);
  return presets.find((p) => p.name === presetName);
}

