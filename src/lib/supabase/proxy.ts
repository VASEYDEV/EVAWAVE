import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "./config";

/**
 * Refreshes the Supabase Auth session for one request (called from src/proxy.ts).
 *
 * Passes the request through untouched when Supabase is not configured (both public
 * variables unset), so the app runs before a Supabase project exists. A partial
 * configuration throws from getSupabasePublicConfig rather than disabling validation.
 * Once it is configured, the auth token is revalidated and any refreshed cookies, plus
 * the no-cache headers the library requires alongside them, are written to both the
 * forwarded request and the response.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const config = getSupabasePublicConfig();
  if (!config) {
    return response;
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses carrying auth cookies must not be cached by a CDN or shared proxy.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Keep this call directly after createServerClient: it validates the JWT and triggers
  // the refresh that setAll persists. Code in between can cause random logouts.
  await supabase.auth.getClaims();

  return response;
}
