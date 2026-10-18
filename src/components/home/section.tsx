import Link from "next/link";
import type { ReactNode } from "react";
import { bn } from "@/lib/i18n/bn";
import { cn } from "@/lib/utils";

interface HomeSectionProps {
  id: string;
  title: string;
  hint?: string;
  /** Where "সব দেখুন" leads. Left out when there is nothing more to see. */
  seeAllHref?: string;
  tone?: "plain" | "cloud";
  children: ReactNode;
}

/** A titled band of the home page. Every section uses it, so spacing stays even. */
export function HomeSection({ id, title, hint, seeAllHref, tone = "plain", children }: HomeSectionProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn(tone === "cloud" ? "bg-cloud" : "")}>
      <div className="page-shell py-10 lg:py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id={`${id}-title`} className="text-2xl lg:text-3xl">
              {title}
            </h2>
            {hint ? <p className="mt-1 text-sm text-slate lg:text-base">{hint}</p> : null}
          </div>
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              className="shrink-0 pb-1 text-sm font-bold text-primary underline underline-offset-4 hover:text-indigo-deep lg:text-base"
            >
              {bn.home.seeAll}
            </Link>
          ) : null}
        </div>
        <div className="mt-5 lg:mt-7">{children}</div>
      </div>
    </section>
  );
}
