"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { findDuplicatesAction, resolveDuplicateAction } from "@/app/admin/duplicates/actions";
import { Button } from "@/components/ui/button";
import { toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import type { DuplicateDecision } from "@/lib/listings/duplicates";

export function FindDuplicatesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const added = await findDuplicatesAction();
            setMessage(added === null ? bn.duplicates.failed : bn.duplicates.found(toBnDigits(added)));
            if (added) router.refresh();
          })
        }
      >
        {bn.duplicates.find}
      </Button>
      <p className="text-sm" role="status">
        {message}
      </p>
    </div>
  );
}

export function DuplicateDecisionButtons({ pairId, canLater }: { pairId: string; canLater: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const run = (decision: DuplicateDecision) =>
    start(async () => {
      const ok = await resolveDuplicateAction(pairId, decision);
      setFailed(!ok);
      if (ok) router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="flame" disabled={pending} onClick={() => run("merged")}>
        {bn.duplicates.merge}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => run("rejected")}>
        {bn.duplicates.reject}
      </Button>
      {canLater ? (
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run("review_later")}>
          {bn.duplicates.later}
        </Button>
      ) : null}
      {failed ? <p className="w-full text-sm text-destructive">{bn.duplicates.failed}</p> : null}
    </div>
  );
}
