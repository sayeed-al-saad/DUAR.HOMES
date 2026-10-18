"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { CACHE_TAGS } from "@/lib/data";
import { LISTER_STATUS_CHANGES, setOwnListingStatus, type ListerStatusChange } from "@/lib/listings/server";

export async function changeListingStatusAction(listingId: string, status: ListerStatusChange): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !LISTER_STATUS_CHANGES.includes(status) || !/^[0-9a-f-]{36}$/.test(listingId)) return false;
  const changed = await setOwnListingStatus(user, listingId, status);
  // Sold, rented or withdrawn listings leave search and area pages straight away.
  if (changed) updateTag(CACHE_TAGS.listings);
  return changed;
}
