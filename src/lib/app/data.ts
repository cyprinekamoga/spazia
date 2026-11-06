"use client";

import { supabase } from "../supabase";
import { must } from "./session";
import type { Listing, ListingBlock, ListingPhoto, ListingPrivate, ListingSpace, Message, Profile, ProfilePrivate, RequestRow } from "./model";

export interface ListingBundle {
  listing: Listing;
  priv: ListingPrivate | null;
  spaces: ListingSpace[];
  photos: ListingPhoto[];
  host: Profile | null;
}

export async function fetchListingBundle(id: string): Promise<ListingBundle | null> {
  const db = supabase();
  const listing = must(await db.from("listings").select("*").eq("id", id).maybeSingle()) as Listing | null;
  if (!listing) return null;
  const [priv, spaces, photos, host] = await Promise.all([
    db.from("listing_private").select("*").eq("listing_id", id).maybeSingle(),
    db.from("listing_spaces").select("*").eq("listing_id", id),
    db.from("listing_photos").select("*").eq("listing_id", id).order("position"),
    db.from("profiles").select("*").eq("id", listing.host_id).maybeSingle(),
  ]);
  return {
    listing,
    priv: must(priv) as ListingPrivate | null,
    spaces: (must(spaces) as ListingSpace[]).sort((a, b) => a.category.localeCompare(b.category)),
    photos: must(photos) as ListingPhoto[],
    host: must(host) as Profile | null,
  };
}

export type ListingSummary = Listing & { listing_photos: Pick<ListingPhoto, "path" | "position">[]; listing_spaces: Pick<ListingSpace, "category" | "capacity" | "host_price_month">[] };

export async function fetchMyListings(uid: string): Promise<ListingSummary[]> {
  return must(
    await supabase()
      .from("listings")
      .select("*, listing_photos(path, position), listing_spaces(category, capacity, host_price_month)")
      .eq("host_id", uid)
      .order("updated_at", { ascending: false }),
  ) as ListingSummary[];
}

export type HostRequest = RequestRow & {
  renter: Pick<Profile, "id" | "first_name" | "avatar_url" | "about" | "created_at"> | null;
  listing: Pick<Listing, "id" | "title" | "city" | "area_name"> | null;
};

const REQUEST_SELECT =
  "*, request_items(category, quantity, host_price_month), renter:profiles!requests_renter_id_fkey(id, first_name, avatar_url, about, created_at), listing:listings(id, title, city, area_name)";

export async function fetchHostRequests(uid: string): Promise<HostRequest[]> {
  return must(
    await supabase().from("requests").select(REQUEST_SELECT).eq("host_id", uid).order("created_at", { ascending: false }),
  ) as HostRequest[];
}

export async function fetchRequest(id: string): Promise<HostRequest | null> {
  return must(await supabase().from("requests").select(REQUEST_SELECT).eq("id", id).maybeSingle()) as HostRequest | null;
}

export async function fetchBlocks(listingId: string): Promise<ListingBlock[]> {
  return must(await supabase().from("listing_blocks").select("*").eq("listing_id", listingId).order("start_date")) as ListingBlock[];
}

export async function fetchMyProfile(uid: string): Promise<{ profile: Profile | null; priv: ProfilePrivate | null }> {
  const db = supabase();
  const [profile, priv] = await Promise.all([
    db.from("profiles").select("*").eq("id", uid).maybeSingle(),
    db.from("profile_private").select("*").eq("id", uid).maybeSingle(),
  ]);
  return { profile: must(profile) as Profile | null, priv: must(priv) as ProfilePrivate | null };
}

export type ConversationSummary = {
  id: string;
  listing_id: string;
  host_id: string;
  renter_id: string;
  last_message_at: string;
  renter: Pick<Profile, "id" | "first_name" | "avatar_url"> | null;
  listing: Pick<Listing, "id" | "title"> | null;
  messages: Pick<Message, "body" | "kind" | "sender_id" | "created_at">[];
  conversation_reads: { user_id: string; last_read_at: string }[];
};

export async function fetchConversations(uid: string): Promise<ConversationSummary[]> {
  return must(
    await supabase()
      .from("conversations")
      .select(
        "id, listing_id, host_id, renter_id, last_message_at, renter:profiles!conversations_renter_id_fkey(id, first_name, avatar_url), listing:listings(id, title), messages(body, kind, sender_id, created_at), conversation_reads(user_id, last_read_at)",
      )
      .eq("host_id", uid)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" }),
  ) as unknown as ConversationSummary[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  return must(await supabase().from("messages").select("*").eq("conversation_id", conversationId).order("created_at")) as Message[];
}

export async function markRead(conversationId: string, uid: string): Promise<void> {
  await supabase().from("conversation_reads").upsert({ conversation_id: conversationId, user_id: uid, last_read_at: new Date().toISOString() });
}
