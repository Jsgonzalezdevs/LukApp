/**
 * Centralized authentication helpers to avoid duplicating admin/permission logic.
 */

export function normalizeEmail(email: string | undefined | null): string {
  return (email?.trim() ?? '').toLowerCase();
}

export function isValidEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
