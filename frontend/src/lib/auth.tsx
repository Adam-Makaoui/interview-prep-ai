import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // A slow or unreachable Supabase Auth (e.g. a hanging token refresh against
    // a paused/misconfigured project) must not trap the whole app on the loading
    // spinner. Clear loading after a bounded wait so public routes still render;
    // getSession()/onAuthStateChange will hydrate the real session if/when it lands.
    const SESSION_BOOT_TIMEOUT_MS = 8000;
    const fallback = setTimeout(() => {
      if (active) setLoading(false);
    }, SESSION_BOOT_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch((err) => {
        // Network/refresh failure (e.g. unreachable project, stale refresh
        // token): log for debugging, stay logged-out rather than hang forever.
        console.error("[auth] getSession failed; continuing logged-out:", err);
      })
      .finally(() => {
        if (!active) return;
        clearTimeout(fallback);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) setSession(s);
    });

    return () => {
      active = false;
      clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    window.location.href = "/";
  };

  return (
    <Ctx.Provider
      value={{ user: session?.user ?? null, session, loading, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}
