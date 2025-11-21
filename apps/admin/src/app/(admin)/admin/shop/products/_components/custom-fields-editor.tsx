"use client";

import { Button } from "@repo/ui/components/ui/button";

import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import type {
  ProductCustomField,
  ProductCustomFieldType,
} from "@/lib/types/product";

type CustomFieldsEditorProps = {
  value: ProductCustomField[];
  onChange: (next: ProductCustomField[]) => void;
};

const customFieldTypes: { value: ProductCustomFieldType; label: string }[] = [
  { value: "text", label: "Single line text" },
  { value: "textarea", label: "Paragraph text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
];

const createField = (): ProductCustomField => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `field_${Math.random().toString(36).slice(2)}`,
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  options: [],
});

export function CustomFieldsEditor({
  value = [],
  onChange,
}: CustomFieldsEditorProps) {
  const fields = value || [];

  const updateField = (index: number, patch: Partial<ProductCustomField>) => {
    const next = fields.map((field, idx) =>
      idx === index ? { ...field, ...patch } : field
    );
    onChange(next);
  };

  const removeField = (index: number) => {
    const next = [...fields];
    next.splice(index, 1);
    onChange(next);
  };

  const addField = () => {
    onChange([...fields, createField()]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-lg">Custom fields</h3>
          <p className="text-muted-foreground text-sm">
            Collect additional information from customers during checkout.
            Responses show up on the order.
          </p>
        </div>
        <Button onClick={addField} type="button">
          <Plus className="mr-2 h-4 w-4" />
          Add field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
          No custom fields configured. Use the button above to add one.
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div className="rounded-lg border p-4" key={field.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-1">
                    <Label>Field label</Label>
                    <Input
                      onChange={(event) =>
                        updateField(index, { label: event.target.value })
                      }
                      placeholder="E.g. Student ID, Name for engraving"
                      value={field.label}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Field type</Label>
                    <Select
                      onValueChange={(value: ProductCustomFieldType) =>
                        updateField(index, {
                          type: value,
                          options:
                            value === "select"
                              ? (field.options ?? [])
                              : undefined,
                        })
                      }
                      value={field.type}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {customFieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => removeField(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove field</span>
                </Button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Placeholder (optional)</Label>
                  <Input
                    onChange={(event) =>
                      updateField(index, { placeholder: event.target.value })
                    }
                    placeholder="Shown inside the input to guide customers"
                    value={field.placeholder || ""}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <Switch
                    checked={!!field.required}
                    onCheckedChange={(checked) =>
                      updateField(index, { required: checked })
                    }
                  />
                  <div className="space-y-1">
                    <Label className="text-sm">Required</Label>
                    <p className="text-muted-foreground text-xs">
                      Customers must fill this before checkout.
                    </p>
                  </div>
                </div>
              </div>

              {field.type === "select" ? (
                <div className="mt-4 space-y-1">
                  <Label>Options</Label>
                  <Textarea
                    onChange={(event) => {
                      const raw = event.target.value;
                      const options = raw
                        .split("\n")
                        .map((option) => option.trim())
                        .filter(Boolean);
                      updateField(index, { options });
                    }}
                    placeholder={
                      "Each option on a new line\nLocker A\nLocker B"
                    }
                    rows={4}
                    value={(field.options || []).join("\n")}
                  />
                  <p className="text-muted-foreground text-xs">
                    Customers will pick one option. The first option is selected
                    by default.
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
