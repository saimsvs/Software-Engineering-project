/**
 * Crypto-free unique id.
 *
 * `uuid` v4 needs `crypto.getRandomValues`, which React Native does not
 * provide (no Web Crypto global). Calling it threw inside the offline-save
 * catch block, so nothing was ever queued. This generator is dependency-free
 * and collision-safe enough for local queue ids.
 */
export function newId(prefix = "local"): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
