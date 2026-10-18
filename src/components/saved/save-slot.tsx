import { Heart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { bn } from "@/lib/i18n/bn";
import { isListingSaved } from "@/lib/saved/server";
import { SaveButton } from "./save-button";

/**
 * The save button, for the visitor in front of us. Reads the session, so it
 * sits in its own Suspense boundary while the rest of the listing page is cached.
 */
export async function SaveSlot({ listingId, returnTo }: { listingId: string; returnTo: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
            <Heart aria-hidden className="size-4" />
            {bn.save.loginToSave}
          </Link>
        </Button>
        <p className="mt-1.5 text-xs text-slate">{bn.save.hint}</p>
      </div>
    );
  }
  return <SaveButton listingId={listingId} initialSaved={await isListingSaved(user, listingId)} />;
}

/** Shown while the session is read. Same size, so nothing jumps. */
export function SaveSlotFallback() {
  return (
    <div aria-hidden>
      <div className="h-11 rounded-lg border border-line" />
      <p className="mt-1.5 text-xs text-transparent">{bn.save.hint}</p>
    </div>
  );
}
