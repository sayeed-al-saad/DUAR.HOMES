"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { handleReportsAction } from "@/app/admin/reports/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

const t = bn.reports;

/** Staff buttons for one reported listing: take it down, mark the reports handled, or dismiss them. */
export function ReportActions({ listingId, canRemove }: { listingId: string; canRemove: boolean }) {
  const id = useId();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const run = (outcome: "resolved" | "dismissed", remove: boolean) => {
    if (remove && !window.confirm(t.confirmRemove)) return;
    start(async () => {
      const ok = await handleReportsAction(listingId, outcome, note, remove);
      setFailed(!ok);
      if (ok) router.refresh();
    });
  };

  return (
    <div>
      <label htmlFor={`${id}-note`} className="block text-sm font-bold">
        {t.note}
      </label>
      <input
        id={`${id}-note`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={1000}
        className="mt-1.5 h-11 w-full max-w-xl rounded-lg border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {canRemove ? (
          <Button type="button" variant="flame" disabled={pending} onClick={() => run("resolved", true)}>
            {t.remove}
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={() => run("resolved", false)}>
          {t.resolve}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run("dismissed", false)}>
          {t.dismiss}
        </Button>
      </div>
      {failed ? <p className="mt-2 text-sm text-destructive">{t.failed}</p> : null}
    </div>
  );
}
