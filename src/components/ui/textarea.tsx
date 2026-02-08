import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-40 w-full rounded-xl border border-black/10 bg-white/78 px-4 py-3 font-mono text-sm leading-6 text-zinc-800 shadow-inner shadow-black/8 backdrop-blur-sm transition-colors",
        "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
