/**
 * Where to send a user after sign-in. Only same-site paths are allowed, so a crafted link
 * cannot turn the auth callback into an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/library"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Control characters and backslashes can be normalised by browsers into another origin.
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  return next;
}
