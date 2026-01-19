"use server";

import type { Config } from "@puckeditor/core";

/**
 * Component schema information for AI context
 */
export type ComponentSchema = {
  type: string;
  label: string;
  description?: string;
  fields: FieldSchema[];
  defaultProps?: Record<string, unknown>;
};

export type FieldSchema = {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  arrayFields?: Record<string, FieldSchema>;
  objectFields?: Record<string, FieldSchema>;
};

/**
 * Parse a single field configuration into a FieldSchema
 */
function parseFieldConfig(fieldName: string, fieldConfig: any): FieldSchema {
  const fieldType = fieldConfig.type || "text";

  const field: FieldSchema = {
    name: fieldName,
    type: fieldType,
    label: fieldConfig.label,
  };

  if (fieldType === "array") {
    field.arrayFields = fieldConfig.arrayFields || {};
  }

  if (fieldType === "object") {
    field.objectFields = fieldConfig.objectFields || {};
  }

  if (fieldConfig.options) {
    field.options = fieldConfig.options;
  }

  return field;
}

/**
 * Parse a component configuration into a ComponentSchema
 */
function parseComponentConfig(
  componentType: string,
  componentConfig: any
): ComponentSchema {
  const fields: FieldSchema[] = [];

  if (componentConfig.fields) {
    for (const [fieldName, fieldConfig] of Object.entries(
      componentConfig.fields
    )) {
      fields.push(parseFieldConfig(fieldName, fieldConfig));
    }
  }

  return {
    type: componentType,
    label: componentConfig.label || componentType,
    description: componentConfig.description,
    fields,
    defaultProps: componentConfig.defaultProps,
  };
}

/**
 * Extract component schemas from Puck config for AI context
 * This provides the AI with full knowledge of available blocks and their fields
 *
 * @param config - The Puck config object (must be passed from non-server context)
 */
export function getPuckSchema(
  config: Config<any, any, any>
): ComponentSchema[] {
  if (!config) {
    throw new Error("Puck config is not loaded");
  }

  if (!config.components) {
    throw new Error("Puck config.components is not defined");
  }

  const schemas: ComponentSchema[] = [];

  for (const [componentType, componentConfig] of Object.entries(
    config.components
  )) {
    schemas.push(parseComponentConfig(componentType, componentConfig));
  }

  return schemas;
}

/**
 * Format a single field for AI output
 */
function formatFieldForAI(field: FieldSchema): string[] {
  const lines: string[] = [];
  const required = field.required ? " (required)" : "";
  const label = field.label ? ` - ${field.label}` : "";
  lines.push(`- \`${field.name}\`: ${field.type}${label}${required}`);

  if (field.options) {
    const opts = field.options.map((o) => o.value).join(", ");
    lines.push(`  Options: ${opts}`);
  }

  if (field.arrayFields) {
    lines.push("  Array item fields:");
    for (const [subName, subField] of Object.entries(field.arrayFields)) {
      lines.push(`    - \`${subName}\`: ${subField.type}`);
    }
  }

  return lines;
}

/**
 * Format a single schema for AI output
 */
function formatSingleSchemaForAI(schema: ComponentSchema): string[] {
  const lines: string[] = [];

  lines.push(`## ${schema.label} (type: "${schema.type}")`);
  if (schema.description) {
    lines.push(schema.description);
  }
  lines.push("");
  lines.push("**Fields:**");

  for (const field of schema.fields) {
    lines.push(...formatFieldForAI(field));
  }

  if (schema.defaultProps) {
    lines.push("");
    lines.push("**Default props:**");
    lines.push("```json");
    lines.push(JSON.stringify(schema.defaultProps, null, 2));
    lines.push("```");
  }

  lines.push("");
  return lines;
}

/**
 * Generate a concise schema description for AI prompt context
 */
export function formatSchemaForAI(schemas: ComponentSchema[]): string {
  const lines: string[] = [
    "# Available Puck Components",
    "",
    "The following components are available for page building:",
    "",
  ];

  for (const schema of schemas) {
    lines.push(...formatSingleSchemaForAI(schema));
  }

  return lines.join("\n");
}

/**
 * Generate example Puck JSON structure for AI reference
 */
export function generatePuckExample(): string {
  console.log("generatePuckExample executed."); // Log for function execution
  return `
# Puck JSON Structure

Pages are defined using this JSON structure:

\`\`\`json
{
  "content": [
    {
      "type": "Hero",
      "props": {
        "id": "Hero-1",
        "title": "Welcome to BISO",
        "description": "The BI Student Organisation",
        "align": "center"
      }
    },
    {
      "type": "FeatureGrid",
      "props": {
        "id": "FeatureGrid-1",
        "title": "Our Features",
        "items": [
          {
            "title": "Feature 1",
            "description": "Description here",
            "icon": "star"
          }
        ]
      }
    }
  ],
  "root": {
    "props": {}
  }
}
\`\`\`

**Important:**
- Each component must have a unique \`id\` in props (e.g., "Hero-1", "FeatureGrid-2")
- The \`content\` array contains all page blocks in order
- The \`root\` object contains page-level settings
`;
}
