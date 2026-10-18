import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Contact the lister. The phone number is never in a public view: it comes
 * only from public.reveal_listing_phone(), which needs a signed-in user, the
 * lister's permission, and stays under a daily limit per account.
 */

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

export type RevealResult =
  | { ok: true; contactName: string | null; phone: string; whatsapp: string | null }
  | { ok: false; reason: "sign_in" | "unavailable" | "daily_limit" | "failed" };

/** Whether this listing's number can be asked for. Says nothing else. */
export async function isPhoneAvailable(listingId: string): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("listing_phone_available", { p_listing_id: listingId });
  if (error) {
    console.error("listing_phone_available failed:", error.code, error.message);
    return false;
  }
  return data === true;
}

export async function revealPhone(listingId: string): Promise<RevealResult> {
  if (!isUuid(listingId)) return { ok: false, reason: "unavailable" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reveal_listing_phone", { p_listing_id: listingId });
  if (error) {
    if (error.hint === "sign_in" || error.code === "42501") return { ok: false, reason: "sign_in" };
    if (error.hint === "unavailable") return { ok: false, reason: "unavailable" };
    if (error.hint === "daily_limit") return { ok: false, reason: "daily_limit" };
    console.error("reveal_listing_phone failed:", error.code, error.message);
    return { ok: false, reason: "failed" };
  }
  const row = (data as Array<{ contact_name: unknown; phone: unknown; whatsapp: unknown }> | null)?.[0];
  if (!row || typeof row.phone !== "string") return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    contactName: typeof row.contact_name === "string" ? row.contact_name : null,
    phone: row.phone,
    whatsapp: typeof row.whatsapp === "string" ? row.whatsapp : null,
  };
}

/** For "my listings": how many different people saw the number of each of my listings. */
export async function getMyRevealCounts(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_listing_reveal_counts");
  if (error) {
    console.error("my_listing_reveal_counts failed:", error.code, error.message);
    return new Map();
  }
  return new Map(((data ?? []) as Array<{ listing_id: string; people: number }>).map((row) => [row.listing_id, Number(row.people)]));
}

/** For "my listings": phone settings of my own listings. Row-level security limits this to the lister. */
export async function getMyPhoneSettings(listingIds: string[]): Promise<Map<string, { hasPhone: boolean; showPhone: boolean }>> {
  const ids = listingIds.filter(isUuid);
  if (ids.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("listing_contacts").select("listing_id, phone, show_phone").in("listing_id", ids);
  if (error) {
    console.error("listing_contacts read failed:", error.code, error.message);
    return new Map();
  }
  return new Map(
    ((data ?? []) as Array<{ listing_id: string; phone: string | null; show_phone: boolean }>).map((row) => [
      row.listing_id,
      { hasPhone: Boolean(row.phone), showPhone: row.show_phone === true },
    ]),
  );
}

/** The lister switches their number on or off. Row-level security makes sure it is their listing. */
export async function setPhoneShown(listingId: string, show: boolean): Promise<boolean> {
  if (!isUuid(listingId)) return false;
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("listing_contacts")
    .update({ show_phone: show }, { count: "exact" })
    .eq("listing_id", listingId);
  if (error) console.error("show_phone change failed:", error.code, error.message);
  return !error && (count ?? 0) > 0;
}

