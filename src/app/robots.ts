import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/structured-data";

/**
 * Search engines may read everything public. Filtered search results, the
 * account area and the API are closed: they are endless or private, and the
 * area pages cover the same listings in a form worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/search", "/account", "/admin", "/login", "/signup", "/auth/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
