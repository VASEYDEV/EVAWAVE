/** Public Supabase connection settings (safe for the browser; RLS enforces access). */
export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads the public Supabase settings, or returns `null` when they are unset.
 * `null` is a legitimate state until a Supabase project is provisioned (S7); callers
 * that cannot work without Supabase use {@link requireSupabasePublicConfig}.
 * The variables are read by their literal names so Next.js can inline them client-side.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Like {@link getSupabasePublicConfig}, but throws a configuration error when unset. */
export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return config;
}
