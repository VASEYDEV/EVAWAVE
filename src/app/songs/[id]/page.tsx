import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleIcon } from "@/components/icons/ModuleIcon";
import { SongHistory } from "@/components/library/SongHistory";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Song · EVAWAVE" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One song's variants (docs/SPEC.md §3 S6), for its owner. */
export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  // Rendered per request: the Supabase settings and the session are request-time facts.
  await connection();
  const { id } = await params;
  if (!getSupabasePublicConfig()) {
    return (
      <main id="main" className="page">
        <h2>
          <ModuleIcon name="library" className="page-icon" /> Song
        </h2>
        <p role="status">
          Songs need Supabase, which is not configured for this deployment (see docs/runbooks/supabase.md). The <Link href="/">composer</Link> works without it.
        </p>
      </main>
    );
  }
  // Checked before any query, so a malformed id never reaches Postgres as a uuid.
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(`/login?next=/songs/${id}`);
  return (
    <main id="main" className="page">
      <div className="page-head">
        <h2>
          <ModuleIcon name="library" className="page-icon" /> Song
        </h2>
        <Link href="/library">Back to the library</Link>
      </div>
      <SongHistory songId={id} />
    </main>
  );
}
