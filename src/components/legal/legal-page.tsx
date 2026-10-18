import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { siteConfig } from "@/lib/config/site";
import { formatDateBn, toBnDigits } from "@/lib/format/bn";
import { bn } from "@/lib/i18n/bn";
import { LEGAL_UPDATED_AT, PRIVACY_PATH, TERMS_PATH, type LegalBlock, type LegalDocument } from "@/lib/legal/content";

/** Turns the contact address inside a sentence into a mail link. */
function WithEmailLink({ text }: { text: string }) {
  const email = siteConfig.contactEmail;
  const parts = text.split(email);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 ? (
            <a href={`mailto:${email}`} className="font-bold text-primary underline underline-offset-4" dir="ltr">
              {email}
            </a>
          ) : null}
        </span>
      ))}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <WithEmailLink text={block} />
      </p>
    );
  }
  return (
    <div>
      {block.lead ? <p className="font-bold text-ink">{block.lead}</p> : null}
      <ul className="mt-2 list-disc space-y-1.5 ps-6 marker:text-indigo">
        {block.list.map((item) => (
          <li key={item}>
            <WithEmailLink text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegalPage({ doc, path }: { doc: LegalDocument; path: string }) {
  const other = path === PRIVACY_PATH ? { href: TERMS_PATH, label: bn.legal.termsLink } : { href: PRIVACY_PATH, label: bn.legal.privacyLink };

  return (
    <div className="page-shell py-8 lg:py-12">
      <Breadcrumbs crumbs={[{ name: bn.nav.home, href: "/" }, { name: doc.title }]} />

      <div className="mt-5 max-w-3xl">
        <h1 className="text-3xl lg:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate">{bn.legal.updated(formatDateBn(LEGAL_UPDATED_AT))}</p>
        <p className="mt-4 text-lg text-slate">{doc.intro}</p>

        <nav aria-label={bn.legal.contents} className="mt-8 rounded-2xl border border-line bg-cloud p-5">
          <h2 className="text-base font-bold">{bn.legal.contents}</h2>
          <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 ps-5 text-sm sm:grid-cols-2">
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-slate hover:text-ink hover:underline">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {doc.sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
              <h2 id={`${section.id}-heading`} className="text-xl lg:text-2xl">
                <span className="text-slate">{`${toBnDigits(index + 1)}. `}</span>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-4 leading-relaxed text-ink/90">
                {section.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-line pt-6 text-sm text-slate">
          {bn.legal.seeAlso}{" "}
          <Link href={other.href} className="font-bold text-primary underline underline-offset-4">
            {other.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
