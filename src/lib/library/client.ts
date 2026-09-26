import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

import type { LibraryClient } from "./repository";
import type { Database } from "./schema";

/** A typed browser client for the library tables. RLS limits it to the signed-in user. */
export function createLibraryClient(): LibraryClient {
  const { url, anonKey } = requireSupabasePublicConfig();
  return createBrowserClient<Database>(url, anonKey);
}
