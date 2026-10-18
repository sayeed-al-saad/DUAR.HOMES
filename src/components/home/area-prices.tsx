import { MIN_SAMPLE_FOR_AVERAGE, type AreaStats } from "@/lib/data/types";
import { formatNumberBn, formatPriceBn } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

function usable(value: number | null, sample: number): value is number {
  return value !== null && sample >= MIN_SAMPLE_FOR_AVERAGE;
}

/**
 * Average asking prices by area.
 *
 * These are means of what listers are asking, shown with how many listings
 * each figure rests on, and labelled as estimates. An average built on too few
 * listings is withheld rather than shown.
 */
export function AreaPrices({ areas, showDemoNote }: { areas: AreaStats[]; showDemoNote: boolean }) {
  const rows = areas.filter(
    (area) => usable(area.avgSalePricePerSqft, area.saleSampleSize) || usable(area.avgMonthlyRent, area.rentSampleSize),
  );

  if (rows.length === 0) {
    return <p className="rounded-xl bg-cloud px-4 py-6 text-slate">{bn.home.notEnoughData}</p>;
  }

  const highestSale = Math.max(
    1,
    ...rows.map((area) => (usable(area.avgSalePricePerSqft, area.saleSampleSize) ? area.avgSalePricePerSqft : 0)),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[36%] sm:w-[34%]" />
            <col className="w-[32%] sm:w-[40%]" />
            <col className="w-[32%] sm:w-[26%]" />
          </colgroup>
          <thead className="bg-cloud text-xs text-slate sm:text-sm">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-bold sm:px-5">
                {bn.home.areaColumn}
              </th>
              <th scope="col" className="px-2 py-2.5 font-bold sm:px-5">
                {bn.home.salePerSqft}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-bold sm:px-5">
                {bn.home.monthlyRent}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((area) => {
              const sale = usable(area.avgSalePricePerSqft, area.saleSampleSize) ? area.avgSalePricePerSqft : null;
              const rent = usable(area.avgMonthlyRent, area.rentSampleSize) ? area.avgMonthlyRent : null;
              return (
                <tr key={area.slug} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-3 text-sm leading-snug font-bold text-ink sm:px-5 sm:text-base">
                    {area.nameBn}
                  </th>
                  <td className="px-2 py-3 sm:px-5">
                    {sale !== null ? (
                      <>
                        <span className="text-sm font-bold whitespace-nowrap text-ink sm:text-base">{formatPriceBn(sale)}</span>
                        <span aria-hidden className="mt-1.5 hidden h-1.5 w-full overflow-hidden rounded-full bg-cloud sm:block">
                          <span
                            className="block h-full rounded-full bg-indigo"
                            style={{ width: `${Math.max(4, Math.round((sale / highestSale) * 100))}%` }}
                          />
                        </span>
                        <span className="mt-0.5 block text-xs whitespace-nowrap text-slate sm:mt-1">
                          {bn.home.sampleSize(formatNumberBn(area.saleSampleSize))}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate sm:text-sm">{bn.home.notEnoughData}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right sm:px-5">
                    {rent !== null ? (
                      <>
                        <span className="text-sm font-bold whitespace-nowrap text-ink sm:text-base">{formatPriceBn(rent)}</span>
                        <span className="mt-0.5 block text-xs whitespace-nowrap text-slate sm:mt-1">
                          {bn.home.sampleSize(formatNumberBn(area.rentSampleSize))}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate sm:text-sm">{bn.home.notEnoughData}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="text-sm text-slate lg:pt-1">
        <h3 className="text-base text-ink">{bn.home.areaPricesHowTitle}</h3>
        {showDemoNote ? (
          <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 font-bold text-amber-ink">{bn.demo.statsNote}</p>
        ) : null}
        <p className="mt-2">{bn.home.areaPricesMethod}</p>
        <p className="mt-2">{bn.home.areaPricesDisclaimer}</p>
      </aside>
    </div>
  );
}
