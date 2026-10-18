import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

/** A doorway with the light on inside. "দুয়ার" means doorway. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="var(--indigo)" />
      <path
        d="M9.5 25.5V14a6.5 6.5 0 0 1 13 0v11.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M13 25.5V14.5a3 3 0 0 1 6 0v11z" fill="var(--flame)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={bn.footer.homeLink(siteConfig.name)}
      className={cn("flex items-center gap-2.5 rounded-lg", className)}
    >
      <LogoMark />
      <span className="text-2xl leading-none font-bold text-ink">{siteConfig.name}</span>
    </Link>
  );
}
