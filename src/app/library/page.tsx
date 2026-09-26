import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleIcon } from "@/components/icons/ModuleIcon";
import { Library } from "@/components/library/Library";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Library · EVAWAVE" };

const LIBRARY_HUE = { "--hue": "var(--mod-library)" } as CSSProperties;

/** The library (docs/SPEC.md §1.6, §3 S4): style profiles, files and genre tags, per user. */
export default async function LibraryPage() {
  // Rendered per request: the Supabase settings and the session are request-time facts.
  await connection();
  if (!getSupabasePublicConfig()) {
    return (
      <main id="main" className="page" style={LIBRARY_HUE}>
        <h2>
          <ModuleIcon name="library" className="page-icon" /> Library
        </h2>
        <p role="status">
          The library needs Supabase, which is not configured for this deployment (see docs/runbooks/supabase.md). The <Link href="/">composer</Link> works without it.
        </p>
      </main>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/library");
  const email = typeof data.claims.email === "string" ? data.claims.email : "your account";
  return (
    <main id="main" className="page" style={LIBRARY_HUE}>
      <div className="page-head">
        <h2>
          <ModuleIcon name="library" className="page-icon" /> Library
        </h2>
        <form action="/auth/signout" method="post">
          <button type="submit">Sign out of {email}</button>
        </form>
      </div>
      <Library />
    </main>
  );
}
