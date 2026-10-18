import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A still placeholder block. No shimmer: it would only cost battery on cheap phones. */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-md bg-secondary", className)} {...props} />;
}

export { Skeleton };
