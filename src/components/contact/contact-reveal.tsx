"use client";

import { MessageCircle, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { revealPhoneAction } from "@/app/property/contact-actions";
import { Button } from "@/components/ui/button";
import type { RevealResult } from "@/lib/contact/server";
import { bn } from "@/lib/i18n/bn";

const t = bn.contact;

/** 01712345678 → 8801712345678 (no plus), the form tel: and wa.me links want. */
function international(local: string): string {
  return `88${local.replace(/^\+?88/, "")}`;
}

/** 01712345678 → 01712-345678, easier to read aloud and copy. */
function readable(local: string): string {
  return /^01\d{9}$/.test(local) ? `${local.slice(0, 5)}-${local.slice(5)}` : local;
}

/** "নম্বর দেখুন" on a listing page, for a signed-in visitor. */
export function ContactReveal({ listingId, listingUrl }: { listingId: string; listingUrl: string }) {
  const [result, setResult] = useState<RevealResult | null>(null);
  const [pending, start] = useTransition();

  const show = () => start(async () => setResult(await revealPhoneAction(listingId)));

  if (result?.ok) {
    const whatsappText = encodeURIComponent(t.whatsappMessage(listingUrl));
    return (
      <div className="rounded-xl bg-cloud p-4" role="status">
        {result.contactName ? <p className="text-sm text-slate">{result.contactName}</p> : null}
        <p className="text-2xl font-bold tabular-nums" dir="ltr">
          {readable(result.phone)}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button asChild variant="flame">
            <a href={`tel:+${international(result.phone)}`}>
              <Phone aria-hidden className="size-4" />
              {t.call}
            </a>
          </Button>
          {result.whatsapp ? (
            <Button asChild variant="outline">
              <a href={`https://wa.me/${international(result.whatsapp)}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden className="size-4" />
                {t.whatsapp}
                <span className="sr-only"> {bn.legal.opensNewTab}</span>
              </a>
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate">{t.mention}</p>
      </div>
    );
  }

  const message =
    result && !result.ok
      ? result.reason === "daily_limit"
        ? t.dailyLimit
        : result.reason === "unavailable"
          ? t.unavailable
          : result.reason === "sign_in"
            ? t.signInAgain
            : t.failed
      : null;

  return (
    <div>
      <Button type="button" variant="flame" className="w-full" disabled={pending} onClick={show}>
        <Phone aria-hidden className="size-4" />
        {pending ? t.revealing : t.reveal}
      </Button>
      <p className="mt-1.5 text-xs text-slate" aria-live="polite">
        {message ? <span className="text-destructive">{message}</span> : t.revealHint}
      </p>
    </div>
  );
}
