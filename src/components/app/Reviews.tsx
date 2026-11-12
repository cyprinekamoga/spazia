"use client";

import { Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { formatDay } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";

const t = appText.reviews;

interface ReviewState {
  opens_at: string | null;
  closes_at: string | null;
  can_review: boolean;
  mine: { rating: number; body: string; created_at: string; published_at: string | null } | null;
  theirs_written: boolean;
  theirs: { rating: number; body: string; published_at: string } | null;
}

interface ListingReviews {
  count: number;
  average: number | null;
  reviews: { rating: number; body: string; published_at: string; author: string | null }[];
}

const decimal = (n: number | string | null) => (n == null ? "" : String(n).replace(".", ","));

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={fill(t.stars, { n: String(rating) })} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden="true" className={i <= Math.round(rating) ? "fill-[#E8A33D] text-[#E8A33D]" : "text-line"} />
      ))}
    </span>
  );
}

/** "★ 4,8 (3)" for cards and headers. */
export function RatingBadge({ average, count }: { average: number | string | null; count: number }) {
  if (!count || average == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-night">
      <Star size={14} className="fill-[#E8A33D] text-[#E8A33D]" aria-hidden="true" />
      {decimal(average)} <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

function dateOnly(iso: string): string {
  return formatDay(iso.slice(0, 10), true);
}

/** Leave (or see) your review for one rental. */
export function ReviewSection({ requestId, otherName, role }: { requestId: string; otherName: string; role: "host" | "renter" }) {
  const { data, loading, reload } = useLoad(async () => {
    const res = await supabase().rpc("review_state", { p_request: requestId });
    return (res.data ?? null) as ReviewState | null;
  }, `review-${requestId}`);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !data) return null;
  const { mine, theirs } = data;
  const opens = data.opens_at ? new Date(data.opens_at) : null;
  if (!mine && !data.can_review && !(opens && opens > new Date())) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    setError(null);
    const res = await supabase().rpc("submit_review", { p_request: requestId, p_rating: rating, p_body: body.trim() });
    setBusy(false);
    if (res.error) setError(appText.common.error);
    else await reload();
  }

  return (
    <section className="card p-5" aria-labelledby={`review-${requestId}`}>
      <h2 id={`review-${requestId}`} className="text-xl font-bold text-night">
        {fill(role === "renter" ? t.yourTitleRenter : t.yourTitleHost, { name: otherName })}
      </h2>
      {mine ? (
        <div className="mt-2 space-y-1">
          <Stars rating={mine.rating} size={20} />
          {mine.body && <p className="whitespace-pre-wrap text-ink">{mine.body}</p>}
          <p className="text-sm text-muted">{mine.published_at ? fill(t.published, { date: dateOnly(mine.published_at) }) : fill(t.hiddenUntil, { name: otherName })}</p>
        </div>
      ) : data.can_review ? (
        <form onSubmit={submit} className="mt-2">
          <fieldset>
            <legend className="field-label">{t.ask}</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={fill(t.stars, { n: String(n) })}
                  aria-pressed={rating === n}
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-frost"
                >
                  <Star size={26} aria-hidden="true" className={n <= rating ? "fill-[#E8A33D] text-[#E8A33D]" : "text-muted"} />
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`review-body-${requestId}`} className="field-label mt-3">
            {t.bodyLabel}
          </label>
          <p className="mb-1 text-sm text-muted">{role === "renter" ? t.bodyHintRenter : fill(t.bodyHintHost, { name: otherName })}</p>
          <textarea id={`review-body-${requestId}`} className="field-input resize-y" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !rating} className="btn btn-primary mt-3">
            {busy ? t.sending : t.send}
          </button>
        </form>
      ) : opens ? (
        <p className="mt-1 text-sm text-muted">{fill(t.opensOn, { date: dateOnly(opens.toISOString()) })}</p>
      ) : null}

      {theirs && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm font-semibold text-muted">{fill(t.theirs, { name: otherName })}</p>
          <Stars rating={theirs.rating} />
          {theirs.body && <p className="mt-1 whitespace-pre-wrap text-ink">{theirs.body}</p>}
        </div>
      )}
    </section>
  );
}

/** Published reviews of a listing, newest first. */
export function ListingReviewsSection({ listingId }: { listingId: string }) {
  const { data, loading } = useLoad(async () => {
    const res = await supabase().rpc("listing_reviews", { p_listing: listingId, p_limit: 20 });
    return (res.data ?? null) as ListingReviews | null;
  }, `listing-reviews-${listingId}`);
  if (loading || !data) return null;
  return (
    <section className="mt-8" aria-labelledby="listing-reviews">
      <h2 id="listing-reviews" className="text-2xl text-night">
        {t.title}
      </h2>
      {data.count === 0 ? (
        <p className="mt-1 text-muted">{t.none}</p>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-2 text-night">
            <Stars rating={Number(data.average)} />
            <span className="font-semibold">{fill(data.count === 1 ? t.countOne : t.count, { average: decimal(data.average), count: String(data.count) })}</span>
          </p>
          <ul className="mt-4 space-y-4">
            {data.reviews.map((r, i) => (
              <li key={i} className="border-t border-line pt-4">
                <p className="flex flex-wrap items-center gap-2">
                  <Stars rating={r.rating} size={14} />
                  <span className="text-sm font-semibold text-night">{r.author || "–"}</span>
                  <span className="text-sm text-muted">{dateOnly(r.published_at)}</span>
                </p>
                {r.body && <p className="mt-1 whitespace-pre-wrap text-ink">{r.body}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** A renter's rating from hosts, for the host's request page. */
export function RenterRating({ renterId }: { renterId: string }) {
  const { data } = useLoad(async () => {
    const res = await supabase().rpc("renter_rating", { p_user: renterId });
    return (res.data ?? null) as { count: number; average: number | null; latest: { rating: number; body: string }[] | null } | null;
  }, `renter-rating-${renterId}`);
  if (!data) return null;
  if (!data.count) return <p className="text-sm text-muted">{t.noRenterRating}</p>;
  return (
    <div className="text-sm">
      <p className="flex items-center gap-2 font-semibold text-night">
        <Stars rating={Number(data.average)} size={14} />
        {fill(data.count === 1 ? t.renterRatingOne : t.renterRating, { average: decimal(data.average), count: String(data.count) })}
      </p>
      {(data.latest ?? [])
        .filter((r) => r.body)
        .slice(0, 2)
        .map((r, i) => (
          <p key={i} className="mt-1 text-muted">
            ”{r.body}”
          </p>
        ))}
    </div>
  );
}
