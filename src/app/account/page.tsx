import type { Metadata } from "next";
import { Suspense } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { AuthNotConfigured } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { isStaff } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { countOpenReports } from "@/lib/reports/server";

export const metadata: Metadata = { title: bn.account.title, robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="page-shell py-10 lg:py-14">
      <div className="max-w-2xl">
        <h1 className="text-3xl lg:text-4xl">{bn.account.title}</h1>
        <div className="mt-6">
          {isSupabaseConfigured ? (
            <Suspense fallback={<Skeleton className="h-56" />}>
              <AccountDetails />
            </Suspense>
          ) : (
            <AuthNotConfigured />
          )}
        </div>
      </div>
    </div>
  );
}

async function AccountDetails() {
  // The proxy already turned away visitors without a session; this is the real check.
  const user = await requireUser("/account");
  const memberSince = user.createdAt
    ? new Intl.DateTimeFormat("bn-BD", { dateStyle: "long" }).format(new Date(user.createdAt))
    : null;

  const rows: Array<[label: string, value: string]> = [[bn.account.role, bn.roles[user.role]]];
  const openReports = isStaff(user.role) ? await countOpenReports() : 0;
  if (user.email) rows.unshift([bn.account.email, user.email]);
  if (memberSince) rows.push([bn.account.memberSince, memberSince]);

  return (
    <>
      {user.displayName ? <p className="text-xl font-bold">{bn.account.greeting(user.displayName)}</p> : null}

      <dl className="mt-4 divide-y divide-line rounded-2xl border border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-6 px-4 py-3 sm:px-5">
            <dt className="text-sm text-slate">{label}</dt>
            <dd className="min-w-0 truncate text-right font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="flame">
          <Link href="/list-property">{bn.nav.listProperty}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/saved">{bn.account.savedLink}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/listings">{bn.myListings.title}</Link>
        </Button>
        {isStaff(user.role) ? (
          <>
            <Button asChild variant="outline">
              <Link href="/admin/listings">{bn.review.reviewLink}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/duplicates">{bn.account.duplicatesLink}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/reports">{openReports > 0 ? bn.reports.link(toBnDigits(openReports)) : bn.reports.linkNone}</Link>
            </Button>
          </>
        ) : null}
      </div>

      <Alert className="mt-5">{bn.account.comingSoon}</Alert>

      <form action={logoutAction} className="mt-6">
        <Button type="submit" variant="outline">
          {bn.nav.logout}
        </Button>
      </form>
    </>
  );
}
