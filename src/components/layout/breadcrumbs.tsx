import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { bn } from "@/lib/i18n/bn";
import { breadcrumbData, type Crumb } from "@/lib/seo/structured-data";

/** "হোম › ঢাকা › উত্তরা", with the same trail given to search engines. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label={bn.area.breadcrumb} className="text-sm text-slate">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.name}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-ink hover:underline">
                {crumb.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {crumb.name}
              </span>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbData(crumbs)} />
    </nav>
  );
}
