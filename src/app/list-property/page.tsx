import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form/listing-form";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getAmenities, getPopularLocations } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";

const t = bn.submit;

export const metadata: Metadata = {
  title: t.title,
  description: t.metaDescription,
  alternates: { canonical: "/list-property" },
};

export default function ListPropertyPage() {
  return (
    <div className="page-shell py-8 lg:py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl lg:text-4xl">{t.title}</h1>
        <p className="mt-3 text-lg text-slate">{t.intro}</p>
        <ul className="mt-4 space-y-1.5">
          {t.points.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-indigo" />
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {isSupabaseConfigured ? (
            <Suspense fallback={<Skeleton className="h-[40rem] rounded-2xl" />}>
              <FormForSignedInUser />
            </Suspense>
          ) : (
            <Alert variant="notice">
              <AlertTitle>{bn.auth.notConfiguredTitle}</AlertTitle>
              <p className="mt-1">{t.notConfigured}</p>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

async function FormForSignedInUser() {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent("/list-property");
    return (
      <div className="rounded-2xl border border-line p-6">
        <h2 className="text-xl">{t.needLoginTitle}</h2>
        <p className="mt-2 text-slate">{t.needLogin}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="flame">
            <Link href={`/login?next=${next}`}>{t.login}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/signup?next=${next}`}>{t.signup}</Link>
          </Button>
        </div>
      </div>
    );
  }
  const [popularLocations, amenities] = await Promise.all([getPopularLocations(8), getAmenities()]);
  return <ListingForm popularLocations={popularLocations} amenities={amenities} defaultName={user.displayName ?? ""} />;
}
