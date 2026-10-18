import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { siteConfig } from "@/lib/config/site";
import { termsOfUse, TERMS_PATH } from "@/lib/legal/content";

const doc = termsOfUse(siteConfig);

export const metadata: Metadata = {
  title: doc.title,
  description: doc.description,
  alternates: { canonical: TERMS_PATH },
};

export default function Page() {
  return <LegalPage doc={doc} path={TERMS_PATH} />;
}
