// The custom-field definitions and the rules for answering them are shared
// with `apps/api`, which the native app checks out through. Re-exported here so
// the storefront's existing imports keep working against one implementation
// rather than a copy that can drift from the one checkout enforces.
export {
  type ProductCustomField,
  type ProductCustomFieldRow,
  toProductCustomFields,
} from "@repo/shared/utils/product-custom-fields";
