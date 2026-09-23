import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabasePublicConfig } from "./config";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Create one per request; never share it across requests.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is safe here because
          // src/proxy.ts refreshes the session and writes the cookies on every request.
        }
      },
    },
  });
}
