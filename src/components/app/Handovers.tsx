"use client";

import { Camera, CircleAlert, CircleCheck, ClipboardList, Hourglass, Loader2, X } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { formatMoment } from "@/lib/app/model";
import { must, useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";

const t = appText.handover;
const BUCKET = "handover-photos";
type Kind = "dropoff" | "pickup";

export interface Handover {
  id: string;
  request_id: string;
  kind: Kind;
  created_by: string;
  items: string;
  photos: string[];
  created_at: string;
  updated_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  matches: boolean | null;
  response_note: string;
}

/** Resize a photo in the browser before upload (max 1600 px, JPEG). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82));
}

async function loadHandovers(requestId: string): Promise<{ list: Handover[]; urls: Record<string, string> }> {
  const db = supabase();
  const list = must(await db.from("handovers").select("*").eq("request_id", requestId)) as Handover[];
  const paths = list.flatMap((h) => h.photos);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const signed = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  return { list, urls };
}

/**
 * Inventory list with photos at drop-off and pickup, for an accepted storage
 * rental. Either side records it; the other confirms or says what differs.
 */
export function HandoverSection({ requestId, uid, hostId, names }: { requestId: string; uid: string; hostId: string; names: { host: string; renter: string } }) {
  const { data, loading, reload } = useLoad(() => loadHandovers(requestId), `handovers-${requestId}`);
  const [editing, setEditing] = useState<Kind | null>(null);

  const nameOf = (id: string | null) => (id === hostId ? names.host : names.renter);
  const list = data?.list ?? [];
  const byKind = (k: Kind) => list.find((h) => h.kind === k) ?? null;

  return (
    <section className="card p-5" aria-labelledby="handover-title">
      <h2 id="handover-title" className="flex items-center gap-2 text-xl font-bold text-night">
        <ClipboardList size={20} className="text-brand" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{t.lead}</p>
      {loading ? (
        <Loader2 size={22} className="mt-4 animate-spin text-brand" aria-label={appText.common.loading} />
      ) : (
        <div className="mt-4 space-y-5">
          {(["dropoff", "pickup"] as Kind[]).map((kind) => {
            const h = byKind(kind);
            const label = kind === "dropoff" ? t.dropoff : t.pickup;
            if (editing === kind) {
              return (
                <HandoverForm
                  key={kind}
                  kind={kind}
                  requestId={requestId}
                  existing={h}
                  onDone={async () => {
                    setEditing(null);
                    await reload();
                  }}
                  onCancel={() => setEditing(null)}
                />
              );
            }
            return (
              <div key={kind} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <h3 className="font-bold text-night">{label}</h3>
                {h ? (
                  <HandoverView
                    h={h}
                    uid={uid}
                    label={label}
                    urls={data?.urls ?? {}}
                    nameOf={nameOf}
                    otherName={h.created_by === hostId ? names.renter : names.host}
                    onEdit={() => setEditing(kind)}
                    onAnswered={reload}
                  />
                ) : kind === "pickup" && !byKind("dropoff") ? (
                  <p className="mt-1 text-sm text-muted">{t.pickupFirst}</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted">{t.notYet}</p>
                    <button type="button" onClick={() => setEditing(kind)} className="btn btn-secondary mt-2">
                      <Camera size={18} aria-hidden="true" />
                      {fill(t.record, { what: label.toLowerCase() })}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HandoverView({
  h,
  uid,
  label,
  urls,
  nameOf,
  otherName,
  onEdit,
  onAnswered,
}: {
  h: Handover;
  uid: string;
  label: string;
  urls: Record<string, string>;
  nameOf: (id: string | null) => string;
  /** The person who didn't record the list (and confirms it). */
  otherName: string;
  onEdit: () => void;
  onAnswered: () => Promise<void>;
}) {
  const [answering, setAnswering] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = h.created_by === uid;
  const creator = nameOf(h.created_by);

  async function answer(matches: boolean) {
    if (!matches && !note.trim()) {
      setError(t.noteRequired);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await supabase().rpc("answer_handover", { p_handover: h.id, p_matches: matches, p_note: matches ? "" : note.trim() });
    setBusy(false);
    if (res.error) setError(appText.common.error);
    else await onAnswered();
  }

  return (
    <div className="mt-2 space-y-3">
      {h.items && <p className="whitespace-pre-wrap text-[0.95rem] text-ink">{h.items}</p>}
      {h.photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {h.photos.map((p, i) => (
            <li key={p}>
              {urls[p] ? (
                <a href={urls[p]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed, private URLs */}
                  <img src={urls[p]} alt={fill(t.photoAlt, { n: String(i + 1), what: label.toLowerCase() })} className="aspect-square w-full object-cover" />
                </a>
              ) : (
                <div className="aspect-square rounded-lg bg-frost" />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">{fill(t.by, { name: creator, time: formatMoment(h.updated_at) })}</p>
      {h.confirmed_at ? (
        <p className="flex items-start gap-2 text-sm font-semibold text-night">
          <CircleCheck size={17} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          {fill(t.confirmedBy, { name: nameOf(h.confirmed_by), time: formatMoment(h.confirmed_at) })}
        </p>
      ) : h.matches === false ? (
        <p className="flex items-start gap-2 text-sm font-semibold text-[#b42318]">
          <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          {fill(t.mismatch, { name: mine ? otherName : t.you, note: h.response_note })}
        </p>
      ) : mine ? (
        <p className="flex items-start gap-2 text-sm text-[#8a5a00]">
          <Hourglass size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          {fill(t.waiting, { name: otherName })}
        </p>
      ) : null}

      {mine && !h.confirmed_at && (
        <button type="button" onClick={onEdit} className="btn btn-secondary">
          {t.redo}
        </button>
      )}

      {!mine && !h.confirmed_at && h.matches !== false && (
        <div className="rounded-xl bg-frost/60 p-3">
          <p className="font-semibold text-night">{t.yourTurn}</p>
          {answering ? (
            <div className="mt-2">
              <label htmlFor={`note-${h.id}`} className="field-label">
                {t.noteLabel}
              </label>
              <textarea id={`note-${h.id}`} className="field-input resize-y" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => answer(false)} className="btn btn-primary">
                  {t.send}
                </button>
                <button type="button" onClick={() => setAnswering(false)} className="btn btn-secondary">
                  {appText.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={busy} onClick={() => answer(true)} className="btn btn-primary">
                <CircleCheck size={18} aria-hidden="true" />
                {t.matches}
              </button>
              <button type="button" disabled={busy} onClick={() => setAnswering(true)} className="btn btn-secondary">
                <X size={18} aria-hidden="true" />
                {t.notMatches}
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}

function HandoverForm({
  kind,
  requestId,
  existing,
  onDone,
  onCancel,
}: {
  kind: Kind;
  requestId: string;
  existing: Handover | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [items, setItems] = useState(existing?.items ?? "");
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folder] = useState(() => crypto.randomUUID());
  const label = kind === "dropoff" ? t.dropoff : t.pickup;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 30 - photos.length);
    setUploading(list.length);
    for (const file of list) {
      try {
        const blob = await resizeImage(file);
        const path = `${requestId}/${folder}/${crypto.randomUUID()}.jpg`;
        const up = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        setPhotos((p) => [...p, path]);
        setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(blob) }));
      } catch (e) {
        console.error(e);
        setError(appText.common.error);
      }
      setUploading((n) => n - 1);
    }
  }

  async function save() {
    if (!items.trim() && photos.length === 0) {
      setError(t.empty);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await supabase().rpc("save_handover", { p_request: requestId, p_kind: kind, p_items: items.trim(), p_photos: photos });
    setBusy(false);
    if (res.error) setError(appText.common.error);
    else await onDone();
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="font-bold text-night">{label}</h3>
      <label htmlFor={`items-${kind}`} className="field-label mt-3">
        {kind === "dropoff" ? t.items : t.itemsPickup}
      </label>
      <p className="mb-1 text-sm text-muted">{t.itemsHint}</p>
      <textarea id={`items-${kind}`} className="field-input resize-y" rows={4} maxLength={4000} value={items} onChange={(e) => setItems(e.target.value)} />
      <p className="field-label mt-3">{t.photos}</p>
      {photos.length > 0 && (
        <ul className="mb-2 grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <li key={p} className="relative">
              {previews[p] ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                <img src={previews[p]} alt={fill(t.photoAlt, { n: String(i + 1), what: label.toLowerCase() })} className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-square rounded-lg bg-frost" />
              )}
              <button
                type="button"
                onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-night/70 text-white"
                aria-label={appText.common.delete}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="btn btn-secondary cursor-pointer">
        <Camera size={18} aria-hidden="true" />
        {uploading > 0 ? fill(t.uploading, { n: String(uploading) }) : t.addPhotos}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading > 0} onChange={(e) => add(e.target.files)} />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy || uploading > 0} onClick={save} className="btn btn-primary">
          {busy ? t.saving : t.save}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          {appText.common.cancel}
        </button>
      </div>
    </div>
  );
}
