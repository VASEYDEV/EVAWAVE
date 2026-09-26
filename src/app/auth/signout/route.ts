import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Signs out (POST only, so a link or prefetch cannot end a session). */
export async function POST(request: NextRequest) {
  if (getSupabasePublicConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
