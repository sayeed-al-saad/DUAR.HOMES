/**
 * Only allow redirects to paths on this site. Anything else (absolute URLs,
 * protocol-relative "//host", backslashes) falls back to a safe default, which
 * closes the open-redirect hole in `?next=` parameters.
 */
export function safeNextPath(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("\n")) return fallback;
  try {
    const parsed = new URL(next, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
