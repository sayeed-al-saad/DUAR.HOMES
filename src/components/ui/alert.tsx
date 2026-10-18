import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-xl border px-4 py-3 text-sm", {
  variants: {
    variant: {
      info: "border-indigo-soft bg-indigo-soft/50 text-ink",
      success: "border-indigo-soft bg-indigo-soft text-indigo-deep",
      error: "border-flame-soft bg-flame-soft text-flame-deep",
      notice: "border-amber-soft bg-amber-soft text-amber-ink",
    },
  },
  defaultVariants: { variant: "info" },
});

function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("font-bold", className)} {...props} />;
}

export { Alert, AlertTitle };
