"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { revealPhone, type RevealResult } from "@/lib/contact/server";

/** "নম্বর দেখুন": hands the signed-in visitor the lister's number, within the daily limit. */
export async function revealPhoneAction(listingId: string): Promise<RevealResult> {
  if (typeof listingId !== "string") return { ok: false, reason: "unavailable" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "sign_in" };
  return revealPhone(listingId);
}
