import type { LocationSummary } from "@/lib/data/types";
import { bn } from "@/lib/i18n/bn";
import { HeroSearch } from "./hero-search";

/**
 * Indigo block with the headline, and the search panel sitting half on, half
 * below it. On wide screens a small evening skyline stands on the panel's top
 * edge. The picture is a separate lazy file, so phones never download it.
 */
export function Hero({ popularLocations }: { popularLocations: LocationSummary[] }) {
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-ink text-white">
        <div className="page-shell grid items-end pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10 lg:pb-28">
          <div className="pt-9 pb-8 sm:pt-12 lg:pt-20 lg:pb-16">
            <h1 id="hero-title" className="max-w-[11em] text-4xl sm:text-5xl lg:text-6xl">
              {bn.hero.title}
            </h1>
            <p className="mt-4 max-w-xl text-base text-[#cdd0f3] sm:text-lg">{bn.hero.subtitle}</p>
          </div>
          {/* Decorative, so the alt text is empty. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/skyline.svg"
            alt=""
            width={720}
            height={380}
            loading="lazy"
            decoding="async"
            className="hidden h-auto w-full self-end lg:block"
          />
        </div>
      </section>

      <div className="page-shell relative z-10 -mt-24 lg:-mt-28">
        <HeroSearch popularLocations={popularLocations} />
      </div>
    </>
  );
}
