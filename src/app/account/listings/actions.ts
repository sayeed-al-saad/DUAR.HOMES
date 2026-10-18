"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { CACHE_TAGS } from "@/lib/data";
import { setPhoneShown } from "@/lib/contact/server";
import type { ListingStatus } from "@/lib/domain/types";
import { bn } from "@/lib/i18n/bn";
import { LISTER_STATUS_CHANGES, setOwnListingStatus, updateListing, updateListingPhotos, type ListerStatusChange } from "@/lib/listings/server";
import { submissionErrors, submissionSchema, type SubmissionErrors, type SubmissionInput } from "@/lib/listings/submission-schema";

export async function changeListingStatusAction(listingId: string, status: ListerStatusChange): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !LISTER_STATUS_CHANGES.includes(status) || !/^[0-9a-f-]{36}$/.test(listingId)) return false;
  const changed = await setOwnListingStatus(user, listingId, status);
  // Sold, rented or withdrawn listings leave search and area pages straight away.
  if (changed) updateTag(CACHE_TAGS.listings);
  return changed;
}

/** The lister shows or hides the phone number of one of their listings. Returns the new setting, or null on failure. */
export async function setPhoneShownAction(listingId: string, show: boolean): Promise<boolean | null> {
  const user = await getCurrentUser();
  if (!user || typeof show !== "boolean") return null;
  return (await setPhoneShown(listingId, show)) ? show : null;
}

export type UpdateListingState =
  | { status: "saved"; listingStatus: ListingStatus; userId: string }
  | { status: "error"; errors: SubmissionErrors };

/** Edit step 1: save the form. The browser then uploads any new photos and calls saveListingPhotosAction. */
export async function updateListingAction(listingId: string, input: SubmissionInput): Promise<UpdateListingState> {
  const errorsText = bn.submit.errors;
  const user = await getCurrentUser();
  if (!user) return { status: "error", errors: { form: bn.submit.needLoginTitle } };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", errors: { form: errorsText.fixBelow, ...submissionErrors(parsed.error) } };

  const result = await updateListing(String(listingId), parsed.data);
  if (!result.ok) {
    if (result.reason === "location") return { status: "error", errors: { form: errorsText.fixBelow, locationSlug: errorsText.chooseLocation } };
    if (result.reason === "not_editable") return { status: "error", errors: { form: bn.editListing.notEditable } };
    return { status: "error", errors: { form: errorsText.generic } };
  }
  updateTag(CACHE_TAGS.listings);
  return { status: "saved", listingStatus: result.status, userId: user.id };
}

/** Edit step 2: keep these photos in this order and add the new uploads. Returns the photo count, or null. */
export async function saveListingPhotosAction(listingId: string, keep: string[], newPaths: string[], alt: string): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user || !Array.isArray(keep) || !Array.isArray(newPaths)) return null;
  const count = await updateListingPhotos(
    user,
    String(listingId),
    keep.filter((id) => typeof id === "string"),
    newPaths.filter((path) => typeof path === "string"),
    String(alt ?? ""),
  );
  updateTag(CACHE_TAGS.listings);
  return count;
}
