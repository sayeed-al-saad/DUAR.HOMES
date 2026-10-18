import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { CACHE_TAGS, getPopularLocations } from "@/lib/data";
import { areaPath, PRICE_GUIDE_PATH, searchPath, type SearchMode } from "@/lib/domain/urls";
import { toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { LogoMark } from "./logo";

const BROWSE_LINKS: Array<{ mode: SearchMode; label: string }> = [
  { mode: "buy", label: bn.search.modes.buy },
  { mode: "rent", label: bn.search.modes.rent },
  { mode: "land", label: bn.search.modes.land },
  { mode: "commercial", label: bn.search.modes.commercial },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.locations);

  const areas = await getPopularLocations(10);
  const year = toBnDigits(new Date().getFullYear());

  return (
    <footer className="mt-auto border-t border-line bg-cloud">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.4fr_0.7fr_1fr_1.5fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-2xl leading-none font-bold">{siteConfig.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-slate">{bn.footer.about(siteConfig.name)}</p>
        </div>

        <nav aria-label={bn.footer.browse}>
          <h2 className="text-base font-bold">{bn.footer.browse}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {BROWSE_LINKS.map((link) => (
              <li key={link.mode}>
                <Link href={searchPath({ mode: link.mode })} className="text-slate hover:text-ink hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={PRICE_GUIDE_PATH} className="text-slate hover:text-ink hover:underline">
                {bn.footer.priceGuide}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={bn.footer.areas}>
          <h2 className="text-base font-bold">{bn.footer.areas}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {areas.map((area) => (
              <li key={area.slug}>
                <Link href={areaPath("rent", area.slug)} className="text-slate hover:text-ink hover:underline">
                  {area.nameBn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-base font-bold">{bn.footer.sourcing}</h2>
          <p className="mt-3 text-sm text-slate">{bn.footer.sourcingBody}</p>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="page-shell py-5 text-sm text-slate">{bn.footer.rights(year, siteConfig.name)}</p>
      </div>
    </footer>
  );
}
