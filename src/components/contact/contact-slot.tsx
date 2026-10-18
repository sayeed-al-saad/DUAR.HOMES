import { Phone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { isPhoneAvailable } from "@/lib/contact/server";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";
import { absoluteUrl } from "@/lib/seo/structured-data";
import { ContactReveal } from "./contact-reveal";

const t = bn.contact;

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-cloud px-3 py-2 text-sm">{children}</p>;
}

/** Safety advice shown with every way of contacting a lister. */
export function ContactSafety() {
  return (
    <p className="mt-3 flex gap-2 text-xs text-slate">
      <ShieldAlert aria-hidden className="mt-px size-4 shrink-0 text-flame" />
      {t.safety}
    </p>
  );
}

/**
 * How to reach the lister of a listing made on this site. Reads the session,
 * so it sits in its own Suspense boundary while the rest of the page is cached.
 */
export async function ContactSlot({ listingId, path, isDemo }: { listingId: string; path: string; isDemo: boolean }) {
  if (!isSupabaseConfigured || isDemo) return <Note>{t.demo}</Note>;
  if (!(await isPhoneAvailable(listingId))) return <Note>{t.hidden}</Note>;

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div>
        <Button asChild variant="flame" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(path)}`}>
            <Phone aria-hidden className="size-4" />
            {t.loginToReveal}
          </Link>
        </Button>
        <p className="mt-1.5 text-xs text-slate">{t.loginHint}</p>
      </div>
    );
  }
  return <ContactReveal listingId={listingId} listingUrl={absoluteUrl(path)} />;
}

/** Shown while the session is read. Same size, so nothing jumps. */
export function ContactSlotFallback() {
  return (
    <div aria-hidden>
      <div className="h-11 rounded-lg bg-cloud" />
      <p className="mt-1.5 text-xs text-transparent">{t.revealHint}</p>
    </div>
  );
}
