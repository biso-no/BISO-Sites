"use server";

import type { Config } from "@measured/puck";

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
 * Extract component schemas from Puck config for AI context
 * This provides the AI with full knowledge of available blocks and their fields
 *
 * @param config - The Puck config object (must be passed from non-server context)
 */
export async function getPuckSchema(config: Config<any, any, any>) {
  console.log("Starting getPuckSchema execution.");

  // Safety check: ensure config and config.components exist
  if (!config) {
    console.error("ERROR: config is undefined or null");
    throw new Error("Puck config is not loaded");
  }

  if (!config.components) {
    console.error("ERROR: config.components is undefined or null");
    console.log("Config object:", JSON.stringify(Object.keys(config)));
    throw new Error("Puck config.components is not defined");
  }

  const schemas: ComponentSchema[] = [];

  const componentEntries = Object.entries(config.components);
  console.log(`Found ${componentEntries.length} components in config.`);

  for (const [componentType, componentConfig] of componentEntries) {
    console.log(`--- Processing component: ${componentType} ---`);
    const fields: FieldSchema[] = [];

    if (componentConfig.fields) {
      const fieldEntries = Object.entries(componentConfig.fields);
      console.log(
        `Component ${componentType} has ${fieldEntries.length} fields.`
      );

      for (const [fieldName, fieldConfig] of fieldEntries) {
        const fieldType = (fieldConfig as any).type || "text";
        console.log(`  - Processing field: ${fieldName} (Type: ${fieldType})`);

        const field: FieldSchema = {
          name: fieldName,
          type: fieldType,
          label: (fieldConfig as any).label,
        };

        // Handle array fields
        if (fieldType === "array") {
          field.arrayFields = (fieldConfig as any).arrayFields || {};
          console.log(
            `    -> Array field detected. arrayFields defined: ${!!(fieldConfig as any).arrayFields}`
          );
        }

        // Handle object fields
        if (fieldType === "object") {
          field.objectFields = (fieldConfig as any).objectFields || {};
          console.log(
            `    -> Object field detected. objectFields defined: ${!!(fieldConfig as any).objectFields}`
          );
        }

        // Handle select/radio options
        if ((fieldConfig as any).options) {
          field.options = (fieldConfig as any).options;
          console.log(
            `    -> Options detected: ${field.options?.length} options.`
          );
        }

        fields.push(field);
      }
    } else {
      console.log(`Component ${componentType} has no 'fields' property.`);
    }

    const componentSchema = {
      type: componentType,
      label: (componentConfig as any).label || componentType,
      description: (componentConfig as any).description,
      fields,
      defaultProps: (componentConfig as any).defaultProps,
    };

    schemas.push(componentSchema);
    console.log(`--- Component ${componentType} schema created. ---`);
  }

  console.log(
    `Finished getPuckSchema. Total schemas generated: ${schemas.length}`
  );
  return schemas;
}

/**
 * Generate a concise schema description for AI prompt context
 */
export async function formatSchemaForAI(
  schemas: ComponentSchema[]
): Promise<string> {
  // Added a log to track when the formatting starts
  console.log(`Starting formatSchemaForAI with ${schemas.length} schemas.`);

  const lines: string[] = [
    "# Available Puck Components",
    "",
    "The following components are available for page building:",
    "",
  ];

  for (const schema of schemas) {
    // Added a log for each component being formatted
    console.log(`Formatting schema for component: ${schema.type}`);

    lines.push(`## ${schema.label} (type: "${schema.type}")`);
    if (schema.description) {
      lines.push(schema.description);
    }
    lines.push("");
    lines.push("**Fields:**");

    for (const field of schema.fields) {
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
    }

    if (schema.defaultProps) {
      lines.push("");
      lines.push("**Default props:**");
      lines.push("```json");
      lines.push(JSON.stringify(schema.defaultProps, null, 2));
      lines.push("```");
    }

    lines.push("");
  }

  // Added a log when the formatting is complete
  console.log("Finished formatSchemaForAI.");

  return lines.join("\n");
}

/**
 * Generate example Puck JSON structure for AI reference
 */
export async function generatePuckExample(): Promise<string> {
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
