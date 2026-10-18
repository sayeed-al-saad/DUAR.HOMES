import { bn } from "@/lib/i18n/bn";

/** Shown whenever what is on screen includes demo rows, so nobody mistakes it for real stock. */
export function DemoBanner() {
  return (
    <p role="note" className="bg-amber-soft px-4 py-2 text-center text-sm text-amber-ink">
      {bn.demo.banner}
    </p>
  );
}
