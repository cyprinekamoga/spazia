"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { site } from "./site";

let client: SupabaseClient | null = null;

/**
 * The browser's Supabase client for the app. The session is kept in the
 * browser; the "implicit" flow lets an email login link work even when it
 * opens in another browser than the one that asked for it.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(site.appSupabaseUrl, site.appSupabaseKey, {
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export function photoUrl(path: string): string {
  return supabase().storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
}
