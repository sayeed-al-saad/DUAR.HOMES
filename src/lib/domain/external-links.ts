import type { ExternalSearchLink } from "@/lib/data/types";
import { inLocationBn } from "@/lib/format/bn";
import { bn, PURPOSE_LABEL } from "@/lib/i18n/bn";
import type { PropertyCategory, Purpose } from "./types";

/**
 * Helpers for the "search on other sites" links: how a link is described, and
 * which links fit what a visitor is looking for.
 */

/** "ঢাকায় ফ্ল্যাট ও বাড়ি ভাড়া", "সারা দেশে জমি ও প্লট বিক্রি", "সিলেটে সব প্রপার্টি". */
export function describeLinkBn(link: Pick<ExternalSearchLink, "purpose" | "category" | "locationNameBn">): string {
  const place = link.locationNameBn ? inLocationBn(link.locationNameBn) : bn.otherSites.everywhere;
  const kind = bn.otherSites.kinds[link.category ?? "all"];
  return [place, kind, link.purpose ? PURPOSE_LABEL[link.purpose] : null].filter(Boolean).join(" ");
}

export interface LinkContext {
  purpose?: Purpose | null;
  category?: PropertyCategory | null;
  /** Slug of the city being searched, if any. */
  citySlug?: string | null;
}

function fits(link: ExternalSearchLink, context: LinkContext): boolean {
  if (context.purpose && link.purpose && link.purpose !== context.purpose) return false;
  if (context.category && link.category && link.category !== context.category) return false;
  // A city page is only offered to someone searching that city.
  if (link.locationSlug && link.locationSlug !== context.citySlug) return false;
  return true;
}

function closeness(link: ExternalSearchLink, context: LinkContext): number {
  return (
    (link.locationSlug ? 4 : 0) +
    (context.purpose && link.purpose === context.purpose ? 2 : 0) +
    (context.category && link.category === context.category ? 1 : 0)
  );
}

/** The links that fit a search, closest match first, at most `perSource` from each site. */
export function matchExternalLinks(links: ExternalSearchLink[], context: LinkContext, perSource = 2): ExternalSearchLink[] {
  const ranked = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => fits(link, context))
    .sort((a, b) => closeness(b.link, context) - closeness(a.link, context) || a.index - b.index);

  const taken = new Map<string, number>();
  const result: ExternalSearchLink[] = [];
  for (const { link } of ranked) {
    const count = taken.get(link.sourceSlug) ?? 0;
    if (count >= perSource) continue;
    taken.set(link.sourceSlug, count + 1);
    result.push(link);
  }
  return result;
}

export interface SourceLinkGroup {
  sourceSlug: string;
  sourceName: string;
  sourceWebsite: string | null;
  links: ExternalSearchLink[];
}

/** Groups links by site, keeping the order in which sites first appear. */
export function groupBySource(links: ExternalSearchLink[]): SourceLinkGroup[] {
  const groups = new Map<string, SourceLinkGroup>();
  for (const link of links) {
    let group = groups.get(link.sourceSlug);
    if (!group) {
      group = { sourceSlug: link.sourceSlug, sourceName: link.sourceName, sourceWebsite: link.sourceWebsite, links: [] };
      groups.set(link.sourceSlug, group);
    }
    group.links.push(link);
  }
  return [...groups.values()];
}

/** For a chosen location, the city whose pages should be offered: the city itself, or the city an area sits in. */
export function cityOf(location: { slug: string; type: string; parentSlug?: string | null } | null): string | null {
  if (!location) return null;
  if (location.type === "city") return location.slug;
  if (location.type === "area") return location.parentSlug ?? null;
  return null;
}
