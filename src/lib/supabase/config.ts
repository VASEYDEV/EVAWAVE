/** Public Supabase connection settings (safe for the browser; RLS enforces access). */
export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads the public Supabase settings.
 *
 * Returns `null` only when both variables are unset, which is the legitimate state
 * until a Supabase project is provisioned. If exactly one is set, it throws: a
 * partial configuration is a deployment error, and treating it as "not configured"
 * would silently switch off session validation in src/proxy.ts. Callers that cannot
 * work without Supabase use {@link requireSupabasePublicConfig}.
 * The variables are read by their literal names so Next.js can inline them client-side.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return { url, anonKey };
  }
  if (url || anonKey) {
    const missing = url ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_SUPABASE_URL";
    throw new Error(`Supabase is partially configured: ${missing} is unset (see .env.example).`);
  }
  return null;
}

/** Like {@link getSupabasePublicConfig}, but also throws when neither variable is set. */
export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return config;
}
