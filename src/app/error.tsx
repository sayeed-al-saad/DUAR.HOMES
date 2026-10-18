"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell py-20 lg:py-28">
      <h1 className="text-3xl lg:text-4xl">{bn.errors.errorTitle}</h1>
      <p className="mt-3 max-w-xl text-slate">{bn.errors.errorBody}</p>
      <Button onClick={() => retry()} className="mt-7">
        {bn.errors.retry}
      </Button>
    </div>
  );
}
