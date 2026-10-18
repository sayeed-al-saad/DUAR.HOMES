import "server-only";
import { REPORT_REASONS, LISTING_STATUSES, type ListingStatus, type ReportReason } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Listing reports. Anyone may file one on a listing they can see (the
 * database checks visibility and applies the limits); only staff read and
 * handle them.
 */

type Row = Record<string, unknown>;
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export type FileReportResult = { ok: true } | { ok: false; reason: "invalid" | "already_reported" | "daily_limit" | "busy" | "failed" };

export async function fileReport(listingId: string, reason: string, details: string, contact: string): Promise<FileReportResult> {
  if (!isUuid(listingId) || !(REPORT_REASONS as readonly string[]).includes(reason)) return { ok: false, reason: "invalid" };
  const supabase = await createSupabaseServerClient();
  const row: Row = { listing_id: listingId, reason, details: details.trim().slice(0, 2000) || null };
  const contactText = contact.trim().slice(0, 200);
  if (contactText) row.reporter_contact = contactText;
  // No .select(): visitors may file a report but not read it back.
  const { error } = await supabase.from("reports").insert(row);
  if (error) {
    if (error.hint === "already_reported" || error.hint === "daily_limit" || error.hint === "busy") return { ok: false, reason: error.hint };
    console.error("filing a report failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}

export interface ReportedListing {
  listingId: string;
  title: string;
  slug: string;
  locationSlug: string;
  status: ListingStatus;
  sourceName: string;
  sourceUrl: string | null;
  reports: Array<{ id: string; reason: ReportReason; details: string | null; contact: string | null; signedIn: boolean; createdAt: string }>;
}

/** Staff only: open reports, grouped by listing, the most reported first. */
export async function getOpenReports(): Promise<ReportedListing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, listing_id, reason, details, reporter_contact, reporter_user_id, created_at")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((row) => String(row.listing_id)))];
  const { data: listings } = await supabase
    .from("my_listings")
    .select("id, title, slug, location_slug, status, source_name, source_url")
    .in("id", ids);
  const byId = new Map(((listings ?? []) as Row[]).map((listing) => [String(listing.id), listing]));

  return ids
    .map((id) => {
      const listing = byId.get(id) ?? {};
      return {
        listingId: id,
        title: typeof listing.title === "string" ? listing.title : id,
        slug: String(listing.slug ?? ""),
        locationSlug: String(listing.location_slug ?? ""),
        status: (LISTING_STATUSES as readonly string[]).includes(String(listing.status)) ? (listing.status as ListingStatus) : "active",
        sourceName: String(listing.source_name ?? ""),
        sourceUrl: typeof listing.source_url === "string" ? listing.source_url : null,
        reports: rows
          .filter((row) => String(row.listing_id) === id)
          .map((row) => ({
            id: String(row.id),
            reason: (REPORT_REASONS as readonly string[]).includes(String(row.reason)) ? (row.reason as ReportReason) : "other",
            details: typeof row.details === "string" ? row.details : null,
            contact: typeof row.reporter_contact === "string" ? row.reporter_contact : null,
            signedIn: row.reporter_user_id !== null,
            createdAt: String(row.created_at),
          })),
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
}

/** Staff only: how many reports are open. For the link on the account page. */
export async function countOpenReports(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]);
  return count ?? 0;
}

/** Staff only: close every open report on a listing, optionally taking the listing down. */
export async function handleReports(listingId: string, outcome: "resolved" | "dismissed", note: string, removeListing: boolean): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("handle_listing_reports", {
    p_listing_id: listingId,
    p_outcome: outcome,
    p_note: note.slice(0, 1000),
    p_remove_listing: removeListing,
  });
  if (error) console.error("handle_listing_reports failed:", error.code, error.message);
  return !error;
}
