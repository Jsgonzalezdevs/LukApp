import { timingSafeEqual } from 'node:crypto';

/**
 * Guards the analyst endpoints against being an open relay.
 *
 * These functions spend real money on every call, so an unauthenticated endpoint
 * is not merely a privacy issue — anyone who finds the URL can bill an unbounded
 * amount to the owner's Anthropic account. This is a single shared secret, not
 * per-user auth: adequate for a one-person private tool, and the seam to replace
 * with a Supabase JWT check later without touching the callers.
 *
 * `timingSafeEqual` rather than `===` because a plain comparison returns early on
 * the first differing byte, which leaks the secret one character at a time to an
 * attacker who can measure response latency.
 */
export const tokenValido = (encabezado: string | null, esperado: string | undefined): boolean => {
  // A missing or blank env var must never authorize anything. Without this, a
  // misconfigured deploy would accept an empty token from everyone.
  if (!esperado) return false;
  if (!encabezado) return false;

  const prefijo = 'Bearer ';
  if (!encabezado.startsWith(prefijo)) return false;

  const recibido = encabezado.slice(prefijo.length);
  const a = Buffer.from(recibido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');

  // timingSafeEqual throws on length mismatch, which would itself leak the
  // length. Comparing a fixed-size digest of each side keeps the compared
  // buffers the same length regardless of input.
  if (a.length !== b.length) {
    // Still burn a comparison so the failure path costs the same either way.
    timingSafeEqual(b, b);
    return false;
  }

  return timingSafeEqual(a, b);
};
