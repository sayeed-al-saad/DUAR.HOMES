import Link from "next/link";
import type { AreaStats } from "@/lib/data/types";
import { areaPath } from "@/lib/domain/urls";
import { formatNumberBn } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

/** Shortcuts to the area pages of the places people look in most (rent, the most common search). */
export function PopularAreas({ areas }: { areas: AreaStats[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3.5">
      {areas.map((area) => (
        <li key={area.slug}>
          <Link
            href={areaPath("rent", area.slug)}
            className="flex h-full min-h-22 flex-col justify-between rounded-2xl bg-cloud px-4 py-3.5 hover:bg-indigo-soft"
          >
            <span className="text-lg leading-snug font-bold text-ink">{area.nameBn}</span>
            <span className="mt-1 text-sm text-slate">
              {area.activeListingCount > 0
                ? bn.home.listingCount(formatNumberBn(area.activeListingCount))
                : bn.home.noListingsYet}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
