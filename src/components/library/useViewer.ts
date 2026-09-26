/**
 * The signed-in account, followed as it changes: undefined while checking (or with no
 * client, when Supabase is not configured), null when signed out. It hears sign-in changes
 * in this tab, and checks the session again whenever the tab is shown or focused, because
 * a sign-out or an account switch in another tab changes the cookies without telling this
 * page. A page that shows a user's rows keeps them with the account they were loaded for,
 * and renders them only while that account is the viewer.
 */
import { useEffect, useState } from "react";

import type { LibraryClient } from "@/lib/library/repository";

export function useViewer(client: LibraryClient | null): string | null | undefined {
  const [viewer, setViewer] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let live = true;
    const check = () =>
      client.auth.getSession().then(
        ({ data }) => {
          if (live) setViewer(data.session?.user.id ?? null);
        },
        () => {
          if (live) setViewer(null);
        },
      );
    void check();
    const { data } = client.auth.onAuthStateChange((_event, session) => setViewer(session?.user.id ?? null));
    const onReturn = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      live = false;
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [client]);

  return viewer;
}
