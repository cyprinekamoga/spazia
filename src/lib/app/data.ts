"use client";

import { supabase } from "../supabase";
import { must } from "./session";
import type { AppMode, Listing, ListingBlock, ListingPhoto, ListingPrivate, ListingSpace, Message, Profile, ProfilePrivate, RequestRow } from "./model";
import type { CategoryId } from "@/content/categories";

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

export type ListingSummary = Listing & { listing_photos: Pick<ListingPhoto, "path" | "position">[]; listing_spaces: Pick<ListingSpace, "category" | "capacity" | "host_price_month" | "hourly_price">[] };

export async function fetchMyListings(uid: string): Promise<ListingSummary[]> {
  return must(
    await supabase()
      .from("listings")
      .select("*, listing_photos(path, position), listing_spaces(category, capacity, host_price_month, hourly_price)")
      .eq("host_id", uid)
      .order("updated_at", { ascending: false }),
  ) as ListingSummary[];
}

export type HostRequest = RequestRow & {
  renter: Pick<Profile, "id" | "first_name" | "avatar_url" | "about" | "created_at"> | null;
  listing: Pick<Listing, "id" | "title" | "city" | "area_name"> | null;
};

const REQUEST_SELECT =
  "*, request_items(category, quantity, host_price_month, hourly_price, daily_max), renter:profiles!requests_renter_id_fkey(id, first_name, avatar_url, about, created_at), listing:listings(id, title, city, area_name)";

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
  /** The other person: the renter for a host, the host for a renter. */
  other: Pick<Profile, "id" | "first_name" | "avatar_url"> | null;
  listing: Pick<Listing, "id" | "title"> | null;
  messages: Pick<Message, "body" | "kind" | "sender_id" | "created_at">[];
  conversation_reads: { user_id: string; last_read_at: string }[];
};

/** The profile on the other side of a conversation, as a PostgREST embed. */
export function otherProfile(mode: AppMode): string {
  return mode === "host" ? "other:profiles!conversations_renter_id_fkey" : "other:profiles!conversations_host_id_fkey";
}

export async function fetchConversations(uid: string, mode: AppMode): Promise<ConversationSummary[]> {
  return must(
    await supabase()
      .from("conversations")
      .select(
        `id, listing_id, host_id, renter_id, last_message_at, ${otherProfile(mode)}(id, first_name, avatar_url), listing:listings(id, title), messages(body, kind, sender_id, created_at), conversation_reads(user_id, last_read_at)`,
      )
      .eq(mode === "host" ? "host_id" : "renter_id", uid)
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

/* ---------- Renter side ---------- */

export type RenterRequest = RequestRow & {
  host: Pick<Profile, "id" | "first_name" | "avatar_url" | "about" | "created_at"> | null;
  listing: (Pick<Listing, "id" | "title" | "city" | "area_name" | "access" | "access_notes" | "status"> & { listing_photos: Pick<ListingPhoto, "path" | "position">[] }) | null;
};

const RENTER_REQUEST_SELECT =
  "*, request_items(category, quantity, host_price_month, hourly_price, daily_max), host:profiles!requests_host_id_fkey(id, first_name, avatar_url, about, created_at), listing:listings(id, title, city, area_name, access, access_notes, status, listing_photos(path, position))";

export async function fetchRenterRequests(uid: string): Promise<RenterRequest[]> {
  return must(
    await supabase().from("requests").select(RENTER_REQUEST_SELECT).eq("renter_id", uid).order("created_at", { ascending: false }),
  ) as RenterRequest[];
}

export async function fetchRenterRequest(id: string): Promise<RenterRequest | null> {
  return must(await supabase().from("requests").select(RENTER_REQUEST_SELECT).eq("id", id).maybeSingle()) as RenterRequest | null;
}

/** Address and access instructions: readable once the host has accepted. */
export async function fetchListingPrivate(listingId: string): Promise<ListingPrivate | null> {
  return must(await supabase().from("listing_private").select("*").eq("listing_id", listingId).maybeSingle()) as ListingPrivate | null;
}

/** The other person's phone and last name: readable once a request between you is accepted. */
export async function fetchCounterpartPrivate(userId: string): Promise<ProfilePrivate | null> {
  return must(await supabase().from("profile_private").select("id, last_name, phone").eq("id", userId).maybeSingle()) as ProfilePrivate | null;
}

export type SearchResult = Pick<Listing, "id" | "host_id" | "title" | "city" | "area_name" | "space_type" | "size_m2" | "heated" | "published_at"> & {
  listing_photos: Pick<ListingPhoto, "path" | "position">[];
  listing_spaces: Pick<ListingSpace, "category" | "capacity" | "host_price_month" | "hourly_price">[];
};

/** Characters that would break a PostgREST filter. */
function cleanTerm(term: string): string {
  return term.replace(/[,()*%\\:."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Published listings, optionally by place (city or area) and by what they take.
 * `exclude` leaves out the logged-in user's own listings (empty when logged out).
 */
export async function searchListings({ place, category, exclude }: { place: string; category: CategoryId | null; exclude: string }): Promise<SearchResult[]> {
  let q = supabase()
    .from("listings")
    .select("id, host_id, title, city, area_name, space_type, size_m2, heated, published_at, listing_photos(path, position), listing_spaces!inner(category, capacity, host_price_month, hourly_price)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  if (exclude) q = q.neq("host_id", exclude);
  const term = cleanTerm(place);
  if (term) q = q.or(`city.ilike.*${term}*,area_name.ilike.*${term}*`);
  if (category) q = q.eq("listing_spaces.category", category);
  return must(await q) as SearchResult[];
}

export type Availability = { category: CategoryId; capacity: number; available: number };

export async function fetchAvailability(listingId: string, start: string, end: string | null): Promise<Availability[]> {
  return must(await supabase().rpc("listing_availability", { p_listing: listingId, p_start: start, p_end: end })) as Availability[];
}

/** The renter's own open or accepted monthly request on a listing, if any (hourly bookings don't count). */
export async function fetchMyOpenRequest(listingId: string, uid: string): Promise<Pick<RequestRow, "id" | "status" | "expires_at"> | null> {
  const rows = must(
    await supabase()
      .from("requests")
      .select("id, status, expires_at")
      .eq("listing_id", listingId)
      .eq("renter_id", uid)
      .eq("kind", "month")
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false }),
  ) as Pick<RequestRow, "id" | "status" | "expires_at">[];
  return rows.find((r) => r.status === "accepted" || Date.parse(r.expires_at) > Date.now()) ?? null;
}
