"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSavedAction } from "@/app/account/saved/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

/** "সেভ করুন" on the listing page, for a signed-in visitor. */
export function SaveButton({ listingId, initialSaved }: { listingId: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = await setSavedAction(listingId, !saved);
      setFailed(next === null);
      if (next !== null) {
        setSaved(next);
        router.refresh();
      }
    });

  return (
    <div>
      <Button type="button" variant={saved ? "secondary" : "outline"} className="w-full" aria-pressed={saved} disabled={pending} onClick={toggle}>
        <Heart aria-hidden className={cn("size-4", saved && "fill-current")} />
        {saved ? bn.save.saved : bn.save.save}
      </Button>
      <p className="mt-1.5 text-xs text-slate" aria-live="polite">
        {failed ? <span className="text-destructive">{bn.save.failed}</span> : bn.save.hint}
      </p>
    </div>
  );
}
