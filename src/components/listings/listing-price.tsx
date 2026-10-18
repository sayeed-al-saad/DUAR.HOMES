import type { Purpose } from "@/lib/domain/types";
import { formatPriceBn } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

/** "৳ ২.৪৫ কোটি" for sale, "৳ ৫৫,০০০ /মাস" for rent. */
export function ListingPrice({ price, purpose, className }: { price: number; purpose: Purpose; className?: string }) {
  return (
    <p className={cn("text-2xl leading-tight font-bold text-ink", className)}>
      {formatPriceBn(price)}
      {purpose === "rent" ? <span className="ml-1 text-sm font-normal text-slate">/{bn.listing.perMonth}</span> : null}
    </p>
  );
}
