"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

type SessionState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; session: Session };

/** The current login, kept up to date when the user logs in or out. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  useEffect(() => {
    const client = supabase();
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? { status: "signedIn", session: data.session } : { status: "signedOut" });
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: "signedIn", session } : { status: "signedOut" });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

type Load<T> = { loading: boolean; data: T | null; error: string | null; reload: () => Promise<void> };

/**
 * Small data loader for the app pages: runs `fn` when `key` changes and
 * gives a `reload` for after a change.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string): Load<T> {
  const [state, setState] = useState<{ loading: boolean; data: T | null; error: string | null }>({ loading: true, data: null, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures what `fn` depends on
  const run = useCallback(fn, [key]);
  const reload = useCallback(async () => {
    try {
      const data = await run();
      setState({ loading: false, data, error: null });
    } catch (err) {
      console.error(err);
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [run]);
  useEffect(() => {
    // Fetching on mount and when the key changes; state is set after the await.
    void reload();
  }, [reload]);
  return { ...state, reload };
}

/** Throw Supabase errors so useLoad can show them. */
export function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
