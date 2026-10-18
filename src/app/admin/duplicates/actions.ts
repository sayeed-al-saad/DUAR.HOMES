"use server";

import { updateTag } from "next/cache";
import { isStaff } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { CACHE_TAGS } from "@/lib/data";
import { DUPLICATE_DECISIONS, findDuplicateCandidates, resolveDuplicate, type DuplicateDecision } from "@/lib/listings/duplicates";

/** Staff only. The database refuses anyone else, whatever this check says. */
export async function findDuplicatesAction(): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) return null;
  return findDuplicateCandidates();
}

export async function resolveDuplicateAction(pairId: string, decision: DuplicateDecision): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role) || !DUPLICATE_DECISIONS.includes(decision) || !/^[0-9a-f-]{36}$/.test(pairId)) return false;
  const done = await resolveDuplicate(pairId, decision);
  // A merge changes search results, counts and averages straight away.
  if (done && decision === "merged") updateTag(CACHE_TAGS.listings);
  return done;
}
