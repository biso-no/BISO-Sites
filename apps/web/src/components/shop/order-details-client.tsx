"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink, Receipt } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";

type ActionType = "back" | "cart" | "shop" | "print" | "receipt";

type OrderActionsClientProps = PropsWithChildren<{
  type: ActionType;
  receiptUrl?: string;
  className?: string; // For the back button's special positioning
}>;

export function OrderActionsClient({
  type,
  receiptUrl,
  className,
  children,
}: OrderActionsClientProps) {
  const router = useRouter();

  const getActionProps = (actionType: ActionType) => {
    switch (actionType) {
      case "back":
        return {
          onClick: () => router.push("/shop"),
          content: children,
          buttonClass: className || "", // Use the passed className for positioning
          motionProps: {
            animate: { opacity: 1, x: 0 },
            initial: { opacity: 0, x: -20 },
          },
        };

      case "cart":
        return {
          onClick: () => router.push("/shop/cart"),
          content: "Return to Cart",
          buttonClass:
            "bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90",
          motionProps: {
            animate: { opacity: 1, y: 0 },
            initial: { opacity: 0, y: 20 },
            transition: { delay: 0.1 },
          },
        };

      case "shop":
        return {
          onClick: () => router.push("/shop"),
          content: "Continue Shopping",
          buttonClass:
            "w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90",
          motionProps: {
            animate: { opacity: 1, x: 0 },
            initial: { opacity: 0, x: 20 },
            transition: { delay: 0.5 },
          },
        };

      case "print":
        return {
          onClick: () => window.print(),
          content: children,
          buttonClass:
            "w-full border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10",
          variant: "outline" as const,
          motionProps: {
            animate: { opacity: 1, x: 0 },
            initial: { opacity: 0, x: 20 },
            transition: { delay: 0.5 },
          },
        };

      case "receipt":
        return {
          onClick: () => window.open(receiptUrl!, "_blank"),
          content: (
            <>
              <Receipt className="mr-2 h-4 w-4" />
              View Vipps Receipt
              <ExternalLink className="ml-2 h-3 w-3" />
            </>
          ),
          buttonClass: "border-green-300 text-green-700 hover:bg-green-100",
          size: "sm" as const,
          variant: "outline" as const,
          motionProps: {
            animate: { opacity: 1, y: 0 },
            initial: { opacity: 0, y: 0 },
            transition: { delay: 0.2 },
          },
        };

      default:
        return {
          onClick: () => {
            // no-op
          },
          content: null,
          buttonClass: "",
        };
    }
  };

  const { onClick, content, buttonClass, variant, size, motionProps } =
    getActionProps(type);

  if (!content) {
    return null;
  }

  // Render a simple div for the "back" link outside of the main layout flow
  if (type === "back") {
    return (
      <motion.button className={buttonClass} onClick={onClick} {...motionProps}>
        {content}
      </motion.button>
    );
  }

  // Render the buttons that use 'motion' for animation
  return (
    <motion.div {...motionProps} className={type !== "receipt" ? "w-full" : ""}>
      <Button
        className={buttonClass}
        onClick={onClick}
        size={size}
        variant={variant}
      >
        {content}
      </Button>
    </motion.div>
  );
}
