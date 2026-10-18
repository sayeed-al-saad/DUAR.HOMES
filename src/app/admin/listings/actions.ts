"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { CACHE_TAGS } from "@/lib/data";
import { findDuplicateCandidates } from "@/lib/listings/duplicates";
import { reviewListing } from "@/lib/listings/server";

/** Staff only. The database refuses the change for anyone else, whatever this check says. */
export async function reviewListingAction(listingId: string, decision: "active" | "rejected"): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !["active", "rejected"].includes(decision) || !/^[0-9a-f-]{36}$/.test(listingId)) return false;
  const done = await reviewListing(listingId, decision);
  if (done) updateTag(CACHE_TAGS.listings);
  // A newly approved listing may be a property that is already listed: put any likely pair in the duplicate queue.
  if (done && decision === "active") await findDuplicateCandidates();
  return done;
}
