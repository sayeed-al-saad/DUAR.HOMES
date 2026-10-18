import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getDataTimestamp, getPriceGuide, type PriceGuideRow } from "@/lib/data";
import { MIN_SAMPLE_FOR_AVERAGE } from "@/lib/data/types";
import { hasAreaPage } from "@/lib/domain/area-pages";
import { areaPath, PRICE_GUIDE_PATH } from "@/lib/domain/urls";
import { formatDateBn, formatPriceBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { absoluteUrl } from "@/lib/seo/structured-data";

/**
 * The price guide: average asking prices for every place with enough listings.
 * Data people link to, which is what helps a new site get found.
 */

const COLUMNS = [
  { key: "salePerSqft", count: "saleCount", label: bn.prices.salePerSqft },
  { key: "rentSmall", count: "rentSmallCount", label: bn.prices.rentSmall },
  { key: "rentThree", count: "rentThreeCount", label: bn.prices.rentThree },
  { key: "rentLarge", count: "rentLargeCount", label: bn.prices.rentLarge },
  { key: "landPerKatha", count: "landCount", label: bn.prices.landPerKatha },
] as const;

function usable(row: PriceGuideRow, column: (typeof COLUMNS)[number]): boolean {
  return row[column.key] !== null && row[column.count] >= MIN_SAMPLE_FOR_AVERAGE;
}

function hasFigures(row: PriceGuideRow): boolean {
  return COLUMNS.some((column) => usable(row, column));
}

async function guide() {
  const [rows, stamp] = await Promise.all([getPriceGuide(), getDataTimestamp()]);
  const shown = rows.filter((row) => hasAreaPage(row) && hasFigures(row));
  const cities = shown.filter((row) => row.type === "city");
  const groups = cities.map((city) => ({
    city,
    areas: shown.filter((row) => row.parentSlug === city.slug).sort((a, b) => (a.nameEn < b.nameEn ? -1 : 1)),
  }));
  // Places with figures whose city has none of its own.
  const placed = new Set(groups.flatMap((group) => [group.city.slug, ...group.areas.map((area) => area.slug)]));
  const rest = shown.filter((row) => !placed.has(row.slug));
  return { groups, rest, stamp, containsDemoData: shown.some((row) => row.containsDemoData), count: shown.length };
}

export async function generateMetadata(): Promise<Metadata> {
  const { containsDemoData, count } = await guide();
  return {
    title: { absolute: `${bn.prices.title} | ${bn.prices.titleEn}` },
    description: bn.prices.intro,
    alternates: { canonical: PRICE_GUIDE_PATH },
    robots: { index: count > 0 && !containsDemoData, follow: true },
  };
}

function Cell({ row, column }: { row: PriceGuideRow; column: (typeof COLUMNS)[number] }) {
  if (!usable(row, column)) return <td className="px-3 py-3 text-sm text-slate">–</td>;
  return (
    <td className="px-3 py-3 whitespace-nowrap">
      <span className="font-bold tabular-nums">{formatPriceBn(row[column.key] as number)}</span>
      <span className="block text-xs text-slate">{bn.prices.sample(toBnDigits(row[column.count]))}</span>
    </td>
  );
}

function Row({ row, indent }: { row: PriceGuideRow; indent: boolean }) {
  const mode = usable(row, COLUMNS[0]) ? "buy" : usable(row, COLUMNS[4]) ? "land" : "rent";
  return (
    <tr className="border-t border-line">
      <th scope="row" className={`px-3 py-3 text-left ${indent ? "pl-6 font-normal" : "font-bold"}`}>
        <Link href={areaPath(mode, row.slug)} className="hover:underline">
          {row.nameBn}
        </Link>
      </th>
      {COLUMNS.map((column) => (
        <Cell key={column.key} row={row} column={column} />
      ))}
    </tr>
  );
}

export default async function PricesPage() {
  const { groups, rest, stamp, containsDemoData, count } = await guide();

  return (
    <div className="page-shell py-6 lg:py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: bn.prices.titleEn,
          description: bn.prices.intro,
          url: absoluteUrl(PRICE_GUIDE_PATH),
          inLanguage: "bn-BD",
          spatialCoverage: { "@type": "Place", name: "Bangladesh" },
          dateModified: stamp,
          variableMeasured: COLUMNS.map((column) => column.label),
        }}
      />
      {containsDemoData ? (
        <div className="mb-4 overflow-hidden rounded-xl">
          <DemoBanner />
        </div>
      ) : null}
      <Breadcrumbs crumbs={[{ name: bn.area.home, href: "/" }, { name: bn.prices.title }]} />
      <h1 className="mt-3 max-w-3xl text-3xl leading-tight lg:text-4xl">{bn.prices.title}</h1>
      <p className="mt-3 max-w-3xl text-slate">{bn.prices.intro}</p>
      <p className="mt-2 text-sm text-slate">{bn.prices.updated(formatDateBn(stamp))}</p>

      {count === 0 ? (
        <p className="mt-8 rounded-2xl bg-cloud px-5 py-8">{bn.prices.noData}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[46rem] text-left">
            <thead className="bg-cloud text-sm text-slate">
              <tr>
                <th scope="col" className="px-3 py-3">
                  {bn.prices.area}
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className="px-3 py-3">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(({ city, areas }) => (
              <tbody key={city.slug}>
                <Row row={city} indent={false} />
                {areas.map((area) => (
                  <Row key={area.slug} row={area} indent />
                ))}
              </tbody>
            ))}
            {rest.length > 0 ? (
              <tbody>
                {rest.map((row) => (
                  <Row key={row.slug} row={row} indent={false} />
                ))}
              </tbody>
            ) : null}
          </table>
        </div>
      )}

      <section aria-labelledby="method-title" className="mt-10 max-w-3xl">
        <h2 id="method-title" className="text-2xl">
          {bn.prices.methodTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          {bn.prices.method.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
