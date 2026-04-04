import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "#3DA9E0",
    color: "#001731",
    border: "1px solid transparent",
    boxShadow: "0 0 20px rgba(61,169,224,0.25)",
  },
  secondary: {
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  ghost: {
    background: "transparent",
    color: "rgba(255,255,255,0.60)",
    border: "1px solid transparent",
  },
  danger: {
    background: "rgba(248,113,113,0.10)",
    color: "#f87171",
    border: "1px solid rgba(248,113,113,0.25)",
  },
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-sm rounded-2xl gap-2",
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
      style={VARIANTS[variant]}
      type="button"
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  );
}

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

export function PortalLinkButton({
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
      style={VARIANTS[variant]}
    >
      {children}
    </Link>
  );
}
