import type { Metadata } from "next";

import { SignInForm } from "@/components/library/SignInForm";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in · EVAWAVE" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";
  return (
    <main id="main" className="page">
      <h2>Sign in</h2>
      {getSupabasePublicConfig() ? (
        <>
          {linkFailed ? <p role="alert">That sign-in link has expired or was already used. Ask for a new one.</p> : null}
          <SignInForm next={next} />
        </>
      ) : (
        <p role="status">Sign-in is not available yet: Supabase is not configured for this deployment (see docs/runbooks/supabase.md).</p>
      )}
    </main>
  );
}
