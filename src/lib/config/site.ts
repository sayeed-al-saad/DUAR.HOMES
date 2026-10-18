/**
 * Site identity. "দুয়ার" (Duar, "doorway") is a working name: change it here
 * and it changes everywhere, including the footer and page titles.
 */
export const siteConfig = {
  name: "দুয়ার",
  nameEn: "Duar",
  tagline: "বাংলাদেশের প্রপার্টি সার্চ",
  description:
    "ফ্ল্যাট, বাড়ি, জমি ও কমার্শিয়াল স্পেস। বিক্রি আর ভাড়ার লিস্টিং এক জায়গায় খুঁজুন, দাম মিলিয়ে দেখুন।",
  locale: "bn-BD",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Where privacy requests, reports and questions go. Shown in the footer and the legal pages. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@duar.homes",
} as const;
