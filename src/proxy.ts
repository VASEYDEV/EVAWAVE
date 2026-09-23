import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/** Next.js 16 request proxy (the successor to middleware.ts): Supabase session refresh. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
