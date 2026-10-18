import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { siteConfig } from "@/lib/config/site";
import { privacyPolicy, PRIVACY_PATH } from "@/lib/legal/content";

const doc = privacyPolicy(siteConfig);

export const metadata: Metadata = {
  title: doc.title,
  description: doc.description,
  alternates: { canonical: PRIVACY_PATH },
};

export default function Page() {
  return <LegalPage doc={doc} path={PRIVACY_PATH} />;
}
