import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

export const metadata: Metadata = { title: bn.errors.notFoundTitle };

export default function NotFound() {
  return (
    <div className="page-shell py-20 lg:py-28">
      <h1 className="text-3xl lg:text-4xl">{bn.errors.notFoundTitle}</h1>
      <p className="mt-3 max-w-xl text-slate">{bn.errors.notFoundBody}</p>
      <Button asChild className="mt-7">
        <Link href="/">{bn.placeholder.backHome}</Link>
      </Button>
    </div>
  );
}
