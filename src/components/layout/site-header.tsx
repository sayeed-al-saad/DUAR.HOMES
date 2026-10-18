import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { searchPath, type SearchMode } from "@/lib/domain/urls";
import { bn } from "@/lib/i18n/bn";
import { Logo } from "./logo";
import { LoginLink, UserMenu } from "./user-menu";

const MAIN_LINKS: Array<{ mode: SearchMode; label: string }> = [
  { mode: "buy", label: bn.nav.buy },
  { mode: "rent", label: bn.nav.rent },
  { mode: "land", label: bn.nav.land },
  { mode: "commercial", label: bn.nav.commercial },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-background">
      <div className="page-shell flex h-16 items-center gap-6">
        <Logo />

        <nav aria-label={bn.nav.mainNavLabel} className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {MAIN_LINKS.map((link) => (
              <li key={link.mode}>
                <Link
                  href={searchPath({ mode: link.mode })}
                  className="rounded-lg px-3.5 py-2 text-base font-bold text-ink hover:bg-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="flame" size="sm" className="hidden md:inline-flex">
            <Link href="/list-property">
              <Plus aria-hidden />
              {bn.nav.listProperty}
            </Link>
          </Button>
          <Suspense fallback={<LoginLink />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
