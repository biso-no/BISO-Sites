import type { BenefitCategoryKey } from "@repo/shared/utils/benefit-catalog";
import {
  Calendar,
  Coffee,
  Dumbbell,
  Laptop,
  type LucideIcon,
  Moon,
  Plane,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

export const BENEFIT_CATEGORY_ICONS: Record<BenefitCategoryKey, LucideIcon> = {
  events: Calendar,
  food_drink: Coffee,
  health_fitness: Dumbbell,
  nightlife: Moon,
  other: Sparkles,
  shopping: ShoppingBag,
  software: Laptop,
  travel: Plane,
};
