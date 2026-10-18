import type { ReactNode } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { bn } from "@/lib/i18n/bn";

/** Narrow centred column shared by the login and sign-up pages. */
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="page-shell py-10 lg:py-16">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-2 text-slate">{intro}</p>
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

/** Shown instead of the forms while the site runs without Supabase. */
export function AuthNotConfigured() {
  return (
    <Alert variant="notice">
      <AlertTitle>{bn.auth.notConfiguredTitle}</AlertTitle>
      <p className="mt-1">{bn.auth.notConfigured}</p>
    </Alert>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-13" />
    </div>
  );
}
