"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAlertsReadAction } from "@/app/account/saved/actions";
import { Button } from "@/components/ui/button";
import { bn } from "@/lib/i18n/bn";

export function MarkReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (await markAlertsReadAction()) router.refresh();
        })
      }
    >
      {bn.saved.markAllRead}
    </Button>
  );
}
