import { NextResponse, type NextRequest } from "next/server";
import { searchLocations } from "@/lib/data";

/**
 * Location autocomplete for the search box.
 *   GET /api/locations?q=ধান
 *
 * Public reference data only. Answers are cached on the server by query and
 * may be cached by browsers and CDNs, which also blunts repeated requests.
 * Per-visitor rate limiting is part of Phase 8.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);

  try {
    const locations = await searchLocations(query, 8);
    return NextResponse.json(
      { locations },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("location search failed", error);
    return NextResponse.json({ locations: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
