"use client";

import { CirclePlus, CircleUserRound, House, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: bn.nav.home, icon: House, match: (path: string) => path === "/" },
  { href: "/search", label: bn.nav.search, icon: Search, match: (path: string) => path.startsWith("/search") },
  { href: "/list-property", label: bn.nav.listShort, icon: CirclePlus, match: (path: string) => path.startsWith("/list-property") },
  {
    href: "/account",
    label: bn.nav.account,
    icon: CircleUserRound,
    match: (path: string) => ["/account", "/login", "/signup", "/admin"].some((prefix) => path.startsWith(prefix)),
  },
];

/** Thumb-reach menu for phones. Hidden from tablet width up, where the header menu takes over. */
export function MobileNav({ currentPath }: { currentPath?: string }) {
  return (
    <nav
      aria-label={bn.nav.mobileNavLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map((item) => {
          const active = currentPath !== undefined && item.match(currentPath);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[4.25rem] flex-col items-center justify-center gap-0.5 text-xs font-bold",
                  active ? "text-primary" : "text-slate",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.4 : 1.9} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reads the current path so the right item is marked. Needs a Suspense boundary above it. */
export function MobileNavWithActiveItem() {
  const pathname = usePathname();
  return <MobileNav currentPath={pathname} />;
}
