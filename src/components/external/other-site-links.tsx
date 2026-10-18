import { ExternalLink } from "lucide-react";
import type { ExternalSearchLink } from "@/lib/data/types";
import { describeLinkBn, groupBySource } from "@/lib/domain/external-links";
import { bn } from "@/lib/i18n/bn";

function hostOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Buttons that open another property site's own listing pages in a new tab.
 *
 * These are plain links. Nothing from the other site is fetched, stored or
 * shown here, and the site is named in text only (no logos).
 */
export function OtherSiteLinks({ links }: { links: ExternalSearchLink[] }) {
  const groups = groupBySource(links);

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-background">
      {groups.map((group) => {
        const host = hostOf(group.sourceWebsite);
        return (
          <section
            key={group.sourceSlug}
            aria-label={group.sourceName}
            className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-6"
          >
            <div>
              <h3 className="text-lg leading-snug">{group.sourceName}</h3>
              {host ? <p className="text-sm text-slate">{host}</p> : null}
            </div>
            <ul className="flex flex-wrap gap-2">
              {group.links.map((link) => {
                const label = describeLinkBn(link);
                return (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={bn.otherSites.opensOn(label, group.sourceName)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-input bg-background px-3.5 py-1.5 text-sm font-bold text-ink hover:bg-accent"
                    >
                      {label}
                      <ExternalLink aria-hidden className="size-4 shrink-0 text-indigo" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The most recent date any of the links was checked. */
export function latestCheck(links: ExternalSearchLink[]): string | null {
  return links.reduce<string | null>(
    (latest, link) => (latest === null || link.lastCheckedAt > latest ? link.lastCheckedAt : latest),
    null,
  );
}
