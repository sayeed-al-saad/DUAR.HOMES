import { List, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

/** List or map. Plain links, so each view has its own URL and works without script. */
export function ViewToggle({ listHref, mapHref, current }: { listHref: string; mapHref: string; current: "list" | "map" }) {
  const item = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-bold",
      active ? "bg-background text-indigo-deep shadow-sm" : "text-slate hover:text-ink",
    );
  return (
    <nav aria-label={bn.searchPage.viewLabel} className="inline-flex rounded-lg bg-cloud p-1">
      <Link href={listHref} className={item(current === "list")} aria-current={current === "list" ? "page" : undefined}>
        <List aria-hidden className="size-4" />
        {bn.searchPage.viewList}
      </Link>
      <Link href={mapHref} className={item(current === "map")} aria-current={current === "map" ? "page" : undefined}>
        <MapIcon aria-hidden className="size-4" />
        {bn.searchPage.viewMap}
      </Link>
    </nav>
  );
}
