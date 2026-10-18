import { Clock, Layers, Link2, Scale, type LucideIcon } from "lucide-react";
import { bn } from "@/lib/i18n/bn";

// Same order as bn.whyUs.
const ICONS: LucideIcon[] = [Layers, Clock, Link2, Scale];

export function WhyUs() {
  return (
    <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
      {bn.whyUs.map((reason, index) => {
        const Icon = ICONS[index];
        return (
          <li key={reason.title} className="border-t-2 border-ink pt-4">
            <Icon aria-hidden className="size-6 text-flame" strokeWidth={2} />
            <h3 className="mt-3 text-lg leading-snug">{reason.title}</h3>
            <p className="mt-1.5 text-sm text-slate">{reason.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
