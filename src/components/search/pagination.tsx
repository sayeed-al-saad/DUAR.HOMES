import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";

/** Previous / next links with "পাতা ২ / ৫" between them. `hrefFor` builds the address of a page. */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  const linkClass =
    "inline-flex h-11 items-center gap-1.5 rounded-lg border border-input bg-background px-4 font-bold hover:bg-accent";
  return (
    <nav aria-label={bn.searchPage.pagination} className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClass}>
          <ChevronLeft aria-hidden className="size-4" />
          {bn.searchPage.previous}
        </Link>
      ) : null}
      <span className="px-2 text-sm text-slate tabular-nums">{bn.searchPage.pageOf(toBnDigits(page), toBnDigits(pages))}</span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
          {bn.searchPage.next}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
