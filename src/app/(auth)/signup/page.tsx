import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/auth-forms";
import { AuthFormSkeleton, AuthNotConfigured, AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { bn } from "@/lib/i18n/bn";

export const metadata: Metadata = { title: bn.auth.signupTitle, robots: { index: false } };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell title={bn.auth.signupTitle} intro={bn.auth.signupIntro}>
      {isSupabaseConfigured ? (
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignupGate searchParams={searchParams} />
        </Suspense>
      ) : (
        <AuthNotConfigured />
      )}
    </AuthShell>
  );
}

async function SignupGate({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);

  return <SignupForm next={next} />;
}
