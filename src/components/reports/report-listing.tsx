"use client";

import { Flag } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { reportListingAction } from "@/app/property/report-actions";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS, type ReportReason } from "@/lib/domain/types";
import { bn } from "@/lib/i18n/bn";

const t = bn.report;

/** A small "report this listing" link that opens a short form in place. */
export function ReportListing({ listingId }: { listingId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (message?.ok) {
    return (
      <p role="status" className="rounded-lg bg-cloud px-3 py-2 text-sm">
        {message.text}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-slate underline-offset-4 hover:text-ink hover:underline">
        <Flag aria-hidden className="size-4" />
        {t.open}
      </button>
    );
  }

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason) {
      setMessage({ ok: false, text: t.chooseReason });
      return;
    }
    start(async () => {
      const result = await reportListingAction(listingId, reason, details, contact);
      if (result.ok) setMessage({ ok: true, text: t.thanks });
      else
        setMessage({
          ok: false,
          text:
            result.reason === "already_reported" ? t.alreadyReported : result.reason === "daily_limit" ? t.dailyLimit : result.reason === "busy" ? t.busy : t.failed,
        });
    });
  };

  return (
    <form onSubmit={send} className="rounded-2xl border border-line p-4" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base font-bold">
        {t.title}
      </h2>
      <fieldset className="mt-3">
        <legend className="text-sm font-bold">{t.reason}</legend>
        <div className="mt-1.5 space-y-1">
          {REPORT_REASONS.map((value) => (
            <label key={value} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name={`${id}-reason`} value={value} checked={reason === value} onChange={() => {
                  setReason(value);
                  setMessage(null);
                }} className="size-4 accent-indigo" />
              {t.reasons[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-details`} className="mt-3 block text-sm font-bold">
        {t.details}
      </label>
      <textarea
        id={`${id}-details`}
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={2000}
        rows={3}
        aria-describedby={`${id}-details-hint`}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
      />
      <p id={`${id}-details-hint`} className="mt-1 text-xs text-slate">
        {t.detailsHint}
      </p>
      <label htmlFor={`${id}-contact`} className="mt-3 block text-sm font-bold">
        {t.contact}
      </label>
      <input
        id={`${id}-contact`}
        value={contact}
        onChange={(event) => setContact(event.target.value)}
        maxLength={200}
        aria-describedby={`${id}-contact-hint`}
        className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
      />
      <p id={`${id}-contact-hint`} className="mt-1 text-xs text-slate">
        {t.contactHint}
      </p>
      <p aria-live="polite" className="mt-2 text-sm text-destructive empty:hidden">
        {message && !message.ok ? message.text : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          <Flag aria-hidden className="size-4" />
          {pending ? t.sending : t.send}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
