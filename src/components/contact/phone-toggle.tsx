"use client";

import { Phone, PhoneOff } from "lucide-react";
import { useState, useTransition } from "react";
import { setPhoneShownAction } from "@/app/account/listings/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

const t = bn.contact;

/** On "my listings": shows whether the number is visible, and switches it. */
export function PhoneToggle({ listingId, initialShown, people }: { listingId: string; initialShown: boolean; people: string | null }) {
  const [shown, setShown] = useState(initialShown);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = await setPhoneShownAction(listingId, !shown);
      setFailed(next === null);
      if (next !== null) setShown(next);
    });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-cloud px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-bold">
        {shown ? <Phone aria-hidden className="size-4 text-indigo" /> : <PhoneOff aria-hidden className="size-4 text-slate" />}
        {shown ? t.phoneOn : t.phoneOff}
      </span>
      {people ? <span className="text-slate">{people}</span> : null}
      <Button type="button" size="sm" variant="outline" className="ms-auto" disabled={pending} onClick={toggle}>
        {shown ? t.turnOff : t.turnOn}
      </Button>
      <span className="w-full text-destructive empty:hidden" aria-live="polite">
        {failed ? t.changeFailed : ""}
      </span>
    </div>
  );
}
