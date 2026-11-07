"use client";

/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage */
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { fetchMyListings } from "@/lib/app/data";
import { useLoad } from "@/lib/app/session";
import { formatKr, renterPrice } from "@/lib/app/model";
import { photoUrl, supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "../AppShell";

const t = appText.listings;

const STATUS_STYLE = {
  draft: "bg-[#fff6e5] text-[#8a5a00]",
  published: "bg-[#e7f4ec] text-pine",
  paused: "bg-frost text-muted",
};

export function ListingsPage() {
  const uid = useAppSession().user.id;
  const { data, loading, error, reload } = useLoad(() => fetchMyListings(uid), uid);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "published" | "paused") {
    setBusy(id);
    if (status === "published") await supabase().rpc("publish_listing", { p_listing: id });
    else await supabase().from("listings").update({ status }).eq("id", id);
    await reload();
    setBusy(null);
  }

  async function removeDraft(id: string, paths: string[]) {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusy(id);
    if (paths.length) await supabase().storage.from("listing-photos").remove(paths);
    await supabase().from("listings").delete().eq("id", id);
    await reload();
    setBusy(null);
  }

  if (loading) return <Spinner />;
  if (error) return <p className="text-muted">{appText.common.error}</p>;
  const listings = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>
        <Link prefetch={false} href="/vard/annons" className="btn btn-primary !px-4">
          <Plus size={18} aria-hidden="true" />
          {t.create}
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-paper p-6 text-center">
          <p className="leading-relaxed text-muted">{t.empty}</p>
          <Link prefetch={false} href="/vard/annons" className="btn btn-primary mt-5">
            {appText.today.createFirst}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {listings.map((l) => {
            const cover = [...l.listing_photos].sort((a, b) => a.position - b.position)[0];
            const from = l.listing_spaces.length ? Math.min(...l.listing_spaces.map((s) => renterPrice(s.host_price_month))) : null;
            return (
              <li key={l.id} className="card overflow-hidden">
                <Link prefetch={false} href={l.status === "draft" ? `/vard/annons?id=${l.id}` : `/vard/forhandsvisning?id=${l.id}`} className="block">
                  {cover ? (
                    <img src={photoUrl(cover.path)} alt="" className="aspect-[16/10] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[16/10] items-center justify-center bg-frost text-muted">
                      <ImageOff size={28} aria-hidden="true" />
                    </span>
                  )}
                </Link>
                <div className="p-4">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[l.status]}`}>{appText.status[l.status]}</span>
                  <h2 className="mt-2 text-lg leading-snug font-bold text-night">{l.title || t.untitled}</h2>
                  <p className="text-sm text-muted">{[l.area_name, l.city].filter(Boolean).join(", ") || "–"}</p>
                  {from !== null && <p className="text-sm text-muted">från {formatKr(from)} kr/mån</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {l.status === "draft" ? (
                      <>
                        <Link prefetch={false} href={`/vard/annons?id=${l.id}`} className="btn btn-primary !py-2 text-sm">
                          {t.continue}
                        </Link>
                        <button type="button" disabled={busy === l.id} onClick={() => removeDraft(l.id, l.listing_photos.map((p) => p.path))} className="min-h-10 px-2 text-sm font-semibold text-[#b42318] underline underline-offset-4">
                          {t.deleteDraft}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link prefetch={false} href={`/vard/annons?id=${l.id}&steg=review`} className="btn btn-secondary !py-2 text-sm">
                          {t.edit}
                        </Link>
                        <Link prefetch={false} href={`/vard/forhandsvisning?id=${l.id}`} className="btn btn-secondary !py-2 text-sm">
                          {t.preview}
                        </Link>
                        <button type="button" disabled={busy === l.id} onClick={() => setStatus(l.id, l.status === "published" ? "paused" : "published")} className="btn btn-secondary !py-2 text-sm">
                          {l.status === "published" ? t.pause : t.unpause}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {listings.some((l) => l.status !== "draft") && <p className="mt-6 text-sm text-muted">{t.pauseHint}</p>}
    </div>
  );
}
