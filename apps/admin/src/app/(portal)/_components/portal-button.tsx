import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonStyle } from "./studio";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-sm rounded-xl gap-2",
};

export function PortalButton({
  variant = "secondary",
  size = "md",
  loading,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      style={buttonStyle(variant)}
      type="button"
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  children: ReactNode;
  className?: string;
  href: string;
  size?: Size;
  variant?: Variant;
}

function _PortalLinkButton({
  href,
  variant = "secondary",
  size = "md",
  children,
  className = "",
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center font-medium transition-all ${SIZES[size]} ${className}`}
      href={href}
      style={buttonStyle(variant)}
    >
      {children}
    </Link>
  );
}
