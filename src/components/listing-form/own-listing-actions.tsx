"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeListingStatusAction } from "@/app/account/listings/actions";
import { Button } from "@/components/ui/button";
import type { ListingStatus, Purpose } from "@/lib/domain/types";
import { bn } from "@/lib/i18n/bn";

/** Sold / rented / withdraw buttons on "my listings". */
export function OwnListingActions({ listingId, status, purpose }: { listingId: string; status: ListingStatus; purpose: Purpose }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (!["active", "pending_review", "stale"].includes(status)) return null;

  const run = (next: "sold" | "rented" | "archived") =>
    start(async () => {
      const ok = await changeListingStatusAction(listingId, next);
      setFailed(!ok);
      if (ok) router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "pending_review" ? (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(purpose === "rent" ? "rented" : "sold")}>
          {purpose === "rent" ? bn.myListings.markRented : bn.myListings.markSold}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run("archived")}>
        {bn.myListings.withdraw}
      </Button>
      {failed ? <p className="w-full text-sm text-destructive">{bn.myListings.actionFailed}</p> : null}
    </div>
  );
}
