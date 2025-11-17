"use client";

import type { Field } from "@measured/puck";
import { FieldLabel } from "@measured/puck";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import type { DataSourceType } from "../../types";

export type DataSourceFieldProps = {
  field: Field<DataSourceType>;
  name: string;
  value?: DataSourceType;
  onChange: (value: DataSourceType) => void;
  readOnly?: boolean;
};

export function DataSourceField({
  field,
  name,
  value = "manual",
  onChange,
  readOnly,
}: DataSourceFieldProps) {
  return (
    <FieldLabel label={field.label || "Data Source"}>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as DataSourceType)}
        disabled={readOnly}
        className="space-y-3"
      >
        <div className="flex items-center space-x-3 rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50/50 transition-colors">
          <RadioGroupItem value="manual" id={`${name}-manual`} />
          <Label
            htmlFor={`${name}-manual`}
            className="flex-1 cursor-pointer"
          >
            <div className="font-medium">Manual Entry</div>
            <div className="text-sm text-gray-500">
              Enter content manually using the editor
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50/50 transition-colors">
          <RadioGroupItem value="database" id={`${name}-database`} />
          <Label
            htmlFor={`${name}-database`}
            className="flex-1 cursor-pointer"
          >
            <div className="font-medium">Load from Database</div>
            <div className="text-sm text-gray-500">
              Dynamically load content from Appwrite collections
            </div>
          </Label>
        </div>
      </RadioGroup>
    </FieldLabel>
  );
}

// Field configuration for use in Puck config
export const dataSourceField = {
  type: "custom",
  render: DataSourceField,
} as const;

