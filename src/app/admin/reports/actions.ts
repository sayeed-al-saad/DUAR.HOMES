"use server";

import { updateTag } from "next/cache";
import { isStaff } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { CACHE_TAGS } from "@/lib/data";
import { handleReports } from "@/lib/reports/server";

/** Staff only. The database refuses anyone else, whatever this check says. */
export async function handleReportsAction(listingId: string, outcome: "resolved" | "dismissed", note: string, removeListing: boolean): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !["resolved", "dismissed"].includes(outcome)) return false;
  const done = await handleReports(String(listingId), outcome, String(note ?? ""), removeListing === true);
  if (done && removeListing) updateTag(CACHE_TAGS.listings);
  return done;
}
