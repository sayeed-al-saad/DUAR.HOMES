import { Building2, House, LandPlot, Store, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ListingCard } from "@/lib/data/types";
import type { PropertyType } from "@/lib/domain/types";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

/** Stand-in icon when there is no photo to show. */
const TYPE_ICON: Record<PropertyType, LucideIcon> = {
  apartment: Building2,
  room: Building2,
  house: House,
  duplex: House,
  plot: LandPlot,
  land: LandPlot,
  office: Store,
  shop: Store,
  commercial_space: Store,
  warehouse: Store,
};

/** Card widths at each breakpoint, so the browser never downloads a larger image than it shows. */
const SIZES = "(min-width: 1200px) 290px, (min-width: 900px) 31vw, (min-width: 640px) 46vw, 78vw";

/**
 * The picture area of a card.
 *
 * A photo appears only when the data says we may show one. External listings
 * normally have none, and say so, pointing the reader to the original site.
 */
export function ListingMedia({
  listing,
  eager = false,
  sizes = SIZES,
  className,
}: {
  listing: ListingCard;
  eager?: boolean;
  /** Override for larger placements, such as the listing page. */
  sizes?: string;
  className?: string;
}) {
  const Icon = TYPE_ICON[listing.propertyType];

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-cloud", className)}>
      {listing.imageUrl ? (
        <>
          <Image
            src={listing.imageUrl}
            alt={listing.imageAlt ?? listing.title}
            fill
            sizes={sizes}
            className="object-cover"
            loading={eager ? "eager" : "lazy"}
            // SVG placeholders are already tiny; real photos go through the optimiser.
            unoptimized={listing.imageUrl.endsWith(".svg")}
          />
          {listing.isDemo ? (
            <Badge variant="onImage" className="absolute bottom-2 left-2 font-normal">
              {bn.listing.demoPhoto}
            </Badge>
          ) : null}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <Icon aria-hidden className="size-9 text-indigo/45" strokeWidth={1.5} />
          <p className="text-xs text-slate">
            {listing.origin === "external" ? bn.listing.externalNoPhoto : bn.listing.firstPartyNoPhoto}
          </p>
        </div>
      )}
    </div>
  );
}
