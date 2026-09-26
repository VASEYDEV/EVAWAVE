"use client";

import { useId, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Email sign-in link through Supabase Auth (managed auth, CLAUDE.md §5). */
export function SignInForm({ next }: { next: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ kind: "sending" });
        const redirect = new URL("/auth/confirm", window.location.origin);
        redirect.searchParams.set("next", next);
        const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } });
        setState(error ? { kind: "error", message: error.message } : { kind: "sent" });
      }}
    >
      <div className="field">
        <label htmlFor={id}>Email</label>
        <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" className="primary" disabled={state.kind === "sending"}>
        Email me a sign-in link
      </button>
      <p role="status" aria-live="polite">
        {state.kind === "sent" ? "Check your email for the sign-in link." : state.kind === "error" ? `Could not send the link: ${state.message}` : ""}
      </p>
    </form>
  );
}
