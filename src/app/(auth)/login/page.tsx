import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { AuthFormSkeleton, AuthNotConfigured, AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";

export const metadata: Metadata = { title: bn.auth.loginTitle, robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title={bn.auth.loginTitle} intro={bn.auth.loginIntro}>
      {isSupabaseConfigured ? (
        <Suspense fallback={<AuthFormSkeleton />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      ) : (
        <AuthNotConfigured />
      )}
    </AuthShell>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);

  return <LoginForm next={next} initialError={params.error === "confirm" ? bn.auth.errors.confirmFailed : undefined} />;
}
