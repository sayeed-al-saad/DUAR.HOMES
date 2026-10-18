import { siteConfig } from "@/lib/config/site";

/** Absolute address on this site, for structured data and sitemaps. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url.endsWith("/") ? siteConfig.url : `${siteConfig.url}/`).toString();
}

export interface Crumb {
  name: string;
  /** Left out for the current page. */
  href?: string;
}

export function breadcrumbData(crumbs: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.href ? { item: absoluteUrl(crumb.href) } : {}),
    })),
  };
}

export function siteData(): Array<Record<string, unknown>> {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      alternateName: siteConfig.nameEn,
      url: absoluteUrl("/"),
      inLanguage: "bn-BD",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.name,
      alternateName: siteConfig.nameEn,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon.svg"),
    },
  ];
}
