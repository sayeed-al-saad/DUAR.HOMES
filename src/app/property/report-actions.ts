"use server";

import { fileReport, type FileReportResult } from "@/lib/reports/server";

/** "রিপোর্ট পাঠান": works signed in or not. The database applies the limits. */
export async function reportListingAction(listingId: string, reason: string, details: string, contact: string): Promise<FileReportResult> {
  return fileReport(String(listingId ?? ""), String(reason ?? ""), String(details ?? ""), String(contact ?? ""));
}
