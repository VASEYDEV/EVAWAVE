import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "./config";

/** Supabase client for Client Components. Auth is Supabase Auth (BUILD-BRIEF §2). */
export function createClient() {
  const { url, anonKey } = requireSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
