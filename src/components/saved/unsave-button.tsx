"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSavedAction } from "@/app/account/saved/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

export function UnsaveButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setSavedAction(listingId, false);
            setFailed(result === null);
            if (result !== null) router.refresh();
          })
        }
      >
        {bn.save.unsave}
      </Button>
      {failed ? <p className="w-full text-sm text-destructive">{bn.save.failed}</p> : null}
    </>
  );
}
