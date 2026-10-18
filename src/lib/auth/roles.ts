import type { UserRole } from "@/lib/domain/types";

/**
 * Role checks for the UI. The database enforces the same rules through
 * row-level security (private.is_staff / private.is_admin); these helpers only
 * decide what to show.
 */

const STAFF_ROLES: readonly UserRole[] = ["moderator", "admin"];
const LISTER_ROLES: readonly UserRole[] = ["owner", "agent", "developer", "moderator", "admin"];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/** Whether this account type manages listings as part of its role. */
export function isLister(role: UserRole): boolean {
  return LISTER_ROLES.includes(role);
}

export function hasAnyRole(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role);
}
