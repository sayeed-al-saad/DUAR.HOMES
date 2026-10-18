import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The browser's own select, styled. On phones it opens the system picker,
 * which is faster and more familiar than a custom dropdown and costs no
 * JavaScript.
 */
function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full appearance-none rounded-lg border border-input bg-background py-0 pr-10 pl-3.5 text-base text-foreground",
          "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
