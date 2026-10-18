"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewListingAction } from "@/app/admin/listings/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

export function ReviewActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const run = (decision: "active" | "rejected") =>
    start(async () => {
      const ok = await reviewListingAction(listingId, decision);
      setFailed(!ok);
      if (ok) router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="flame" disabled={pending} onClick={() => run("active")}>
        {bn.review.approve}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => run("rejected")}>
        {bn.review.reject}
      </Button>
      {failed ? <p className="w-full text-sm text-destructive">{bn.myListings.actionFailed}</p> : null}
    </div>
  );
}
