import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { ReportActions } from "@/components/reports/report-actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateBn, toBnDigits } from "@/lib/format/bn";
import { bn, LISTING_STATUS_LABEL } from "@/lib/i18n/bn";
import { getOpenReports } from "@/lib/reports/server";

const t = bn.reports;

export const metadata: Metadata = { title: t.title, robots: { index: false, follow: false } };

export default function ReportsPage() {
  return (
    <div className="page-shell py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-slate">{t.intro}</p>
      <div className="mt-6">
        {isSupabaseConfigured ? (
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <Reports />
          </Suspense>
        ) : (
          <AuthNotConfigured />
        )}
      </div>
    </div>
  );
}

async function Reports() {
  await requireRole(["moderator", "admin"], "/admin/reports");
  const listings = await getOpenReports();
  if (listings.length === 0) return <p className="rounded-2xl bg-cloud px-5 py-8">{t.empty}</p>;

  return (
    <ul className="space-y-4">
      {listings.map((listing) => (
        <li key={listing.listingId} className="rounded-2xl border border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl">{listing.title}</h2>
              <p className="mt-1 text-sm text-slate">
                {listing.sourceName} · {t.listingStatus}: {LISTING_STATUS_LABEL[listing.status]}
              </p>
            </div>
            <Badge variant="flame">{t.count(toBnDigits(listing.reports.length))}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {listing.slug && listing.locationSlug ? (
              <Link href={`/property/${listing.locationSlug}/${listing.slug}`} target="_blank" className="font-bold text-primary underline underline-offset-4">
                {t.view}
              </Link>
            ) : null}
            {listing.sourceUrl ? (
              <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                {t.original}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>

          <ul className="mt-4 divide-y divide-line rounded-xl bg-cloud">
            {listing.reports.map((report) => (
              <li key={report.id} className="px-4 py-3 text-sm">
                <p className="font-bold">{bn.report.reasons[report.reason]}</p>
                {report.details ? <p className="mt-1 whitespace-pre-line">{report.details}</p> : null}
                <p className="mt-1 text-xs text-slate">
                  {formatDateBn(report.createdAt)} · {report.signedIn ? t.signedIn : t.anonymous}
                  {report.contact ? ` · ${t.contact}: ${report.contact}` : ""}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <ReportActions listingId={listing.listingId} canRemove={listing.status !== "removed"} />
          </div>
        </li>
      ))}
    </ul>
  );
}
