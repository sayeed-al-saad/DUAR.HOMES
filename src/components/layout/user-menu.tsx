import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { countUnreadAlerts } from "@/lib/saved/server";

/** Shown at once in the page shell; replaced when the session has been read. */
export function LoginLink() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/login">{bn.nav.login}</Link>
    </Button>
  );
}

/**
 * The only part of the header that depends on who is visiting. It streams in
 * behind a Suspense boundary so the rest of every page can be served from cache.
 */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <LoginLink />;
  const unread = await countUnreadAlerts(user);

  return (
    <div className="flex items-center gap-1">
      {unread > 0 ? (
        <Link
          href="/account/saved"
          className="rounded-full bg-flame px-2.5 py-1 text-xs font-bold text-white hover:bg-flame-deep"
          aria-label={bn.saved.badge(toBnDigits(unread))}
        >
          {toBnDigits(unread)}
        </Link>
      ) : null}
      <Button asChild variant="ghost" size="sm" className="max-w-44">
        <Link href="/account">
          <CircleUserRound aria-hidden />
          <span className="truncate">{user.displayName ?? bn.nav.myAccount}</span>
        </Link>
      </Button>
    </div>
  );
}
