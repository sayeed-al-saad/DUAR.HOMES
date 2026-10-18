"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { CACHE_TAGS } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";
import { attachPhotos, submitListing } from "@/lib/listings/server";
import { submissionErrors, submissionSchema, type SubmissionErrors, type SubmissionInput } from "@/lib/listings/submission-schema";

export type SubmitListingState =
  | { status: "saved"; listingId: string; slug: string; userId: string }
  | { status: "error"; errors: SubmissionErrors };

const errorsText = bn.submit.errors;

/** Step 1: save the listing. The browser then uploads photos and calls attachListingPhotos. */
export async function submitListingAction(input: SubmissionInput): Promise<SubmitListingState> {
  if (!isSupabaseConfigured) return { status: "error", errors: { form: bn.submit.notConfigured } };
  const user = await getCurrentUser();
  if (!user) return { status: "error", errors: { form: bn.submit.needLoginTitle } };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", errors: { form: errorsText.fixBelow, ...submissionErrors(parsed.error) } };

  const result = await submitListing(parsed.data);
  if (!result.ok) {
    if (result.reason === "daily_limit") return { status: "error", errors: { form: errorsText.daily } };
    if (result.reason === "location") return { status: "error", errors: { form: errorsText.fixBelow, locationSlug: errorsText.chooseLocation } };
    return { status: "error", errors: { form: errorsText.generic } };
  }
  return { status: "saved", listingId: result.listingId, slug: result.slug, userId: user.id };
}

/** Step 2: record the photos the browser uploaded for the listing. */
export async function attachListingPhotos(listingId: string, paths: string[], alt: string): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(listingId) || !Array.isArray(paths)) return 0;
  const attached = await attachPhotos(user, listingId, paths.filter((path) => typeof path === "string"), String(alt ?? ""));
  // Not public yet, but the lister's own pages should show the photos at once.
  updateTag(CACHE_TAGS.listings);
  return attached;
}
