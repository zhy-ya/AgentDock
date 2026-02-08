import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeIn } from "../utils/constants";

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      {...fadeIn}
      className={cn("glass rounded-2xl shadow-sm overflow-hidden", className)}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Badge({
  variant,
  children,
}: {
  variant: "green" | "yellow" | "gray" | "blue";
  children: React.ReactNode;
}) {
  const cls =
    variant === "green"
      ? "bg-accent-light text-accent"
      : variant === "yellow"
        ? "bg-amber-100 text-amber-700"
        : variant === "blue"
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-400";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        cls,
      )}
    >
      {children}
    </span>
  );
}

export function Btn({
  children,
  primary,
  danger,
  sm,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
  sm?: boolean;
}) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-lg cursor-pointer transition-all duration-150",
        sm ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-[13px]",
        primary
          ? "bg-gradient-to-br from-accent to-green-600 text-white border-0 shadow-[0_2px_6px_rgba(21,128,61,0.2)] hover:shadow-[0_3px_10px_rgba(21,128,61,0.3)]"
          : danger
            ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
            : "bg-white/70 backdrop-blur-sm text-gray-800 border border-black/10 hover:bg-gray-100",
        className,
      )}
    >
      {children}
    </button>
  );
}
