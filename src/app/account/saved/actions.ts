"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { markAllAlertsRead, setListingSaved } from "@/lib/saved/server";

/** Save or unsave a listing. Returns the new state, or null when it could not be changed. */
export async function setSavedAction(listingId: string, saved: boolean): Promise<boolean | null> {
  const user = await getCurrentUser();
  if (!user || typeof saved !== "boolean") return null;
  return (await setListingSaved(user, listingId, saved)) ? saved : null;
}

export async function markAlertsReadAction(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return markAllAlertsRead(user);
}
