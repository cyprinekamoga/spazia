"use client";

/* eslint-disable @next/next/no-img-element -- photos come from Supabase Storage */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  Check,
  ImagePlus,
  Layers,
  Loader2,
  Minus,
  Plus,
  Shapes,
  SquareParking,
  Star,
  Tractor,
  Trash2,
  Triangle,
  Warehouse,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { categoryIcons } from "@/components/Icons";
import { TownField } from "@/components/forms/FormFields";
import { ListingView } from "@/components/app/ListingView";
import { useHostSession, Spinner } from "@/components/app/HostShell";
import { appText } from "@/content/app";
import { categories, type CategoryId } from "@/content/categories";
import { tidyTown } from "@/content/cities";
import { fill } from "@/lib/i18n";
import { fetchListingBundle, type ListingBundle } from "@/lib/app/data";
import {
  ACCESS,
  FEATURES,
  formatKr,
  hostPayout,
  MIN_PERIODS,
  renterPrice,
  SPACE_TYPES,
  suggestedHostPrice,
  type Access,
  type Feature,
  type Heated,
  type Listing,
  type ListingPhoto,
  type ListingPrivate,
  type MinPeriod,
  type SpaceType,
} from "@/lib/app/model";
import { supabase, photoUrl } from "@/lib/supabase";

const t = appText;
const w = appText.wizard.steps;

const STEPS = ["type", "place", "about", "spaces", "photos", "text", "access", "review"] as const;
type Step = (typeof STEPS)[number];

const SPACE_ICONS: Record<SpaceType, typeof Warehouse> = {
  garage: Warehouse,
  carport: CarFront,
  driveway: SquareParking,
  basement: Layers,
  outbuilding: Building2,
  attic: Triangle,
  barn: Tractor,
  other: Shapes,
};

type SpaceDraft = { enabled: boolean; capacity: number; price: string };
type Draft = {
  listing: Partial<Listing>;
  priv: Partial<ListingPrivate>;
  spaces: Record<CategoryId, SpaceDraft>;
  photos: ListingPhoto[];
};

function emptySpaces(): Record<CategoryId, SpaceDraft> {
  return Object.fromEntries(
    categories.map((c) => [c.id, { enabled: false, capacity: c.id === "boxes" ? 5 : 1, price: String(suggestedHostPrice(c.id)) }]),
  ) as Record<CategoryId, SpaceDraft>;
}

function fromBundle(b: ListingBundle): Draft {
  const spaces = emptySpaces();
  for (const s of b.spaces) spaces[s.category] = { enabled: true, capacity: s.capacity, price: String(s.host_price_month) };
  return { listing: b.listing, priv: b.priv ?? {}, spaces, photos: b.photos };
}

/** Which required parts are still missing (mirrors publish_listing in the database). */
function missingParts(d: Draft): string[] {
  const m: string[] = [];
  if (!d.listing.space_type) m.push("space_type");
  if (!d.listing.city) m.push("city");
  if (!d.priv.street_address) m.push("address");
  if ((d.listing.title ?? "").trim().length < 5) m.push("title");
  if (!Object.values(d.spaces).some((s) => s.enabled)) m.push("spaces");
  if (d.photos.length === 0) m.push("photos");
  if (!d.listing.access) m.push("access");
  return m;
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

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-paper px-4 py-3 text-left font-semibold text-ink transition-colors hover:border-night/50 aria-pressed:border-night aria-pressed:bg-frost aria-pressed:text-night"
    >
      {children}
    </button>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ListingWizard() {
  const session = useHostSession();
  const uid = session.user.id;
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState<string | null>(params.get("id"));
  const [draft, setDraft] = useState<Draft | null>(id ? null : { listing: {}, priv: {}, spaces: emptySpaces(), photos: [] });
  const [step, setStep] = useState<Step>("type");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [published, setPublished] = useState(false);

  // Load an existing listing and continue where the host left off.
  useEffect(() => {
    if (!id || draft) return;
    fetchListingBundle(id).then((b) => {
      if (!b || b.listing.host_id !== uid) {
        router.replace("/vard/annonser");
        return;
      }
      setDraft(fromBundle(b));
      const wanted = params.get("steg");
      const fromUrl = STEPS.find((s) => s === wanted);
      setStep(fromUrl ?? (b.listing.status === "draft" ? STEPS[Math.min(b.listing.wizard_step, STEPS.length) - 1] : "review"));
    });
  }, [id, draft, uid, router, params]);

  const index = STEPS.indexOf(step);
  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d)), []);
  const setListing = (patch: Partial<Listing>) => setDraft((d) => (d ? { ...d, listing: { ...d.listing, ...patch } } : d));
  const setPriv = (patch: Partial<ListingPrivate>) => setDraft((d) => (d ? { ...d, priv: { ...d.priv, ...patch } } : d));
  const setSpace = (cat: CategoryId, patch: Partial<SpaceDraft>) =>
    setDraft((d) => (d ? { ...d, spaces: { ...d.spaces, [cat]: { ...d.spaces[cat], ...patch } } } : d));

  const canContinue = useMemo(() => {
    if (!draft) return false;
    const l = draft.listing;
    switch (step) {
      case "type":
        return Boolean(l.space_type);
      case "place":
        return Boolean((draft.priv.street_address ?? "").trim() && (l.city ?? "").trim());
      case "spaces":
        return Object.values(draft.spaces).some((s) => s.enabled && Number(s.price) >= 10);
      case "photos":
        return draft.photos.length > 0;
      case "text":
        return (l.title ?? "").trim().length >= 5;
      case "access":
        return Boolean(l.access);
      default:
        return true;
    }
  }, [draft, step]);

  /** Save the current step. Creates the listing on the first save. Returns its id. */
  async function save(current: Step, nextStep: number): Promise<string | null> {
    if (!draft) return null;
    const db = supabase();
    const l = draft.listing;
    let listingId = id;
    if (!listingId) {
      const { data, error: err } = await db.from("listings").insert({ host_id: uid, space_type: l.space_type }).select("id").single();
      if (err || !data) throw new Error(err?.message ?? "insert");
      listingId = data.id as string;
      setId(listingId);
      window.history.replaceState(null, "", `/vard/annons?id=${listingId}`);
    }
    const base = { wizard_step: Math.max(l.wizard_step ?? 1, nextStep) };
    let patch: Partial<Listing> = {};
    if (current === "type") patch = { space_type: l.space_type };
    if (current === "place") {
      patch = { city: tidyTown(l.city ?? ""), area_name: (l.area_name ?? "").trim() };
      const r = await db.from("listing_private").upsert({
        listing_id: listingId,
        street_address: (draft.priv.street_address ?? "").trim(),
        postal_code: (draft.priv.postal_code ?? "").trim(),
      });
      if (r.error) throw new Error(r.error.message);
    }
    if (current === "about") patch = { size_m2: l.size_m2 ?? null, heated: l.heated ?? null, features: l.features ?? [] };
    if (current === "spaces") {
      const enabled = categories.filter((c) => draft.spaces[c.id].enabled);
      const off = categories.filter((c) => !draft.spaces[c.id].enabled).map((c) => c.id);
      if (off.length) {
        const r = await db.from("listing_spaces").delete().eq("listing_id", listingId).in("category", off);
        if (r.error) throw new Error(r.error.message);
      }
      if (enabled.length) {
        const r = await db.from("listing_spaces").upsert(
          enabled.map((c) => ({
            listing_id: listingId,
            category: c.id,
            capacity: Math.max(1, Math.min(200, draft.spaces[c.id].capacity)),
            host_price_month: Math.max(10, Math.round(Number(draft.spaces[c.id].price) || suggestedHostPrice(c.id))),
          })),
          { onConflict: "listing_id,category" },
        );
        if (r.error) throw new Error(r.error.message);
      }
    }
    if (current === "text") patch = { title: (l.title ?? "").trim(), description: (l.description ?? "").trim() };
    if (current === "access") {
      patch = { access: l.access ?? null, access_notes: (l.access_notes ?? "").trim(), min_period: l.min_period ?? "none", rules: (l.rules ?? "").trim() };
      const r = await db.from("listing_private").upsert({ listing_id: listingId, access_instructions: (draft.priv.access_instructions ?? "").trim() });
      if (r.error) throw new Error(r.error.message);
    }
    const r = await db.from("listings").update({ ...patch, ...base }).eq("id", listingId).select("*").single();
    if (r.error) throw new Error(r.error.message);
    setListing(r.data as Listing);
    return listingId;
  }

  async function go(delta: number) {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const target = Math.max(0, Math.min(STEPS.length - 1, index + delta));
      if (delta > 0) await save(step, target + 1);
      setStep(STEPS[target]);
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error(e);
      setError(t.common.error);
    }
    setBusy(false);
  }

  async function saveAndExit() {
    setBusy(true);
    try {
      if (draft && (id || draft.listing.space_type)) await save(step, index + 1);
      router.push("/vard/annonser");
    } catch (e) {
      console.error(e);
      setError(t.common.error);
      setBusy(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !draft) return;
    setError(null);
    let listingId = id;
    try {
      if (!listingId) listingId = await save(step, index + 1);
    } catch {
      setError(t.common.error);
      return;
    }
    const list = Array.from(files).slice(0, 20);
    setUploading(list.length);
    const added: ListingPhoto[] = [];
    let position = draft.photos.length;
    for (const file of list) {
      try {
        const blob = await resizeImage(file);
        const path = `${uid}/${listingId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase().storage.from("listing-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const row = await supabase().from("listing_photos").insert({ listing_id: listingId, path, position: position++ }).select("*").single();
        if (row.error) throw row.error;
        added.push(row.data as ListingPhoto);
      } catch (e) {
        console.error(e);
        setError(fill(w.photos.tooBig, { name: file.name }));
      }
      setUploading((n) => n - 1);
    }
    setDraft((d) => (d ? { ...d, photos: [...d.photos, ...added] } : d));
  }

  async function reorder(photos: ListingPhoto[]) {
    const renumbered = photos.map((p, i) => ({ ...p, position: i }));
    update({ photos: renumbered });
    await Promise.all(renumbered.map((p) => supabase().from("listing_photos").update({ position: p.position }).eq("id", p.id)));
  }

  async function removePhoto(photo: ListingPhoto) {
    if (!draft) return;
    await supabase().from("listing_photos").delete().eq("id", photo.id);
    await supabase().storage.from("listing-photos").remove([photo.path]);
    await reorder(draft.photos.filter((p) => p.id !== photo.id));
  }

  async function publish() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const r = await supabase().rpc("publish_listing", { p_listing: id });
    setBusy(false);
    if (r.error) {
      setError(r.error.message.startsWith("incomplete") ? w.review.missing : t.common.error);
      return;
    }
    setListing({ status: "published" });
    setPublished(true);
  }

  if (!draft) return <Spinner />;
  const l = draft.listing;
  const missing = missingParts(draft);
  const isPublished = l.status === "published" || l.status === "paused";
  const titleSuggestion = l.space_type
    ? `${l.heated === "yes" ? `Uppvärmt ${t.spaceTypes[l.space_type].toLowerCase()}` : t.spaceTypes[l.space_type]} i ${l.area_name || l.city || "…"}`
    : "";
  const potential = categories.reduce((sum, c) => {
    const s = draft.spaces[c.id];
    return s.enabled ? sum + hostPayout(Number(s.price) || 0) * s.capacity : sum;
  }, 0);

  if (published) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f4ec] text-pine">
          <Check size={34} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl text-night">{w.review.doneTitle}</h1>
        <p className="mt-3 leading-relaxed text-muted">{w.review.doneText}</p>
        <div className="mt-8 flex w-full flex-col gap-3">
          <Link prefetch={false} href={`/vard/forhandsvisning?id=${id}`} className="btn btn-secondary">
            {w.review.preview}
          </Link>
          <Link prefetch={false} href="/vard" className="btn btn-primary">
            {w.review.toToday}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh pb-32">
      <header className="sticky top-0 z-30 border-b border-line bg-snow/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link prefetch={false} href="/vard" aria-label="Spazia">
            <LogoMark className="h-8 w-auto" id="wizard-logo" />
          </Link>
          <button type="button" onClick={saveAndExit} disabled={busy} className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-night hover:border-night">
            {t.wizard.saveExit}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <p className="text-sm font-semibold text-muted">{fill(t.wizard.stepOf, { n: index + 1, total: STEPS.length })}</p>

        {step === "type" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.type.title}</h1>
            <p className="mt-2 text-muted">{w.type.lead}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SPACE_TYPES.map((s) => {
                const Icon = SPACE_ICONS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={l.space_type === s}
                    onClick={() => setListing({ space_type: s })}
                    className="flex min-h-28 flex-col items-start justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-paper p-4 text-left font-semibold text-ink transition-colors hover:border-night/50 aria-pressed:border-night aria-pressed:bg-frost aria-pressed:text-night"
                  >
                    <Icon size={28} className="text-brand" aria-hidden="true" />
                    {t.spaceTypes[s]}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === "place" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.place.title}</h1>
            <p className="mt-2 leading-relaxed text-muted">{w.place.lead}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-[2fr_1fr]">
              <Field id="street" label={w.place.street}>
                <input id="street" className="field-input" autoComplete="street-address" maxLength={200} value={draft.priv.street_address ?? ""} onChange={(e) => setPriv({ street_address: e.target.value })} />
              </Field>
              <Field id="postal" label={w.place.postal}>
                <input id="postal" className="field-input" autoComplete="postal-code" inputMode="numeric" maxLength={12} value={draft.priv.postal_code ?? ""} onChange={(e) => setPriv({ postal_code: e.target.value })} />
              </Field>
              <TownField label={w.place.city} value={l.city ?? ""} onChange={(v) => setListing({ city: v })} />
              <Field id="area" label={w.place.area} hint={w.place.areaHint}>
                <input id="area" className="field-input" maxLength={80} value={l.area_name ?? ""} onChange={(e) => setListing({ area_name: e.target.value })} />
              </Field>
            </div>
          </section>
        )}

        {step === "about" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.about.title}</h1>
            <p className="mt-2 text-muted">{w.about.lead}</p>
            <div className="mt-6 space-y-7">
              <Field id="size" label={w.about.size}>
                <div className="flex max-w-48 items-center gap-2">
                  <input
                    id="size"
                    className="field-input"
                    inputMode="decimal"
                    value={l.size_m2 ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                      setListing({ size_m2: v === "" ? null : Number(v) });
                    }}
                  />
                  <span className="text-muted">{w.about.sizeUnit}</span>
                </div>
              </Field>
              <fieldset>
                <legend className="field-label">{w.about.heated}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["yes", "frostfree", "no"] as Heated[]).map((h) => (
                    <Choice key={h} selected={l.heated === h} onClick={() => setListing({ heated: h })}>
                      {t.heated[h]}
                    </Choice>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="field-label">{w.about.features}</legend>
                <div className="flex flex-wrap gap-2">
                  {FEATURES.map((f) => {
                    const on = (l.features ?? []).includes(f);
                    return (
                      <Choice key={f} selected={on} onClick={() => setListing({ features: on ? (l.features ?? []).filter((x) => x !== f) : [...(l.features ?? []), f as Feature] })}>
                        {on && <Check size={16} aria-hidden="true" />}
                        {t.features[f]}
                      </Choice>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </section>
        )}

        {step === "spaces" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.spaces.title}</h1>
            <p className="mt-2 leading-relaxed text-muted">{w.spaces.lead}</p>
            <ul className="mt-6 space-y-3">
              {categories.map((c) => {
                const s = draft.spaces[c.id];
                const Icon = categoryIcons[c.id];
                const price = Number(s.price) || 0;
                return (
                  <li key={c.id} className={`rounded-2xl border-[1.5px] bg-paper transition-colors ${s.enabled ? "border-night" : "border-line"}`}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                      <input type="checkbox" checked={s.enabled} onChange={(e) => setSpace(c.id, { enabled: e.target.checked })} className="h-5 w-5 shrink-0 accent-[#2f6b75]" />
                      <Icon size={22} className="shrink-0 text-brand" />
                      <span className="font-semibold text-night">{c.name.sv}</span>
                    </label>
                    {s.enabled && (
                      <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2">
                        <div>
                          <p className="field-label">
                            {w.spaces.capacity} ({c.unitPlural.sv})
                          </p>
                          <div className="flex items-center gap-2">
                            <button type="button" aria-label={`Färre ${c.unitPlural.sv}`} disabled={s.capacity <= 1} onClick={() => setSpace(c.id, { capacity: s.capacity - 1 })} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-35">
                              <Minus size={16} aria-hidden="true" />
                            </button>
                            <output className="w-10 text-center text-lg font-semibold">{s.capacity}</output>
                            <button type="button" aria-label={`Fler ${c.unitPlural.sv}`} disabled={s.capacity >= 200} onClick={() => setSpace(c.id, { capacity: s.capacity + 1 })} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-night hover:border-night disabled:opacity-35">
                              <Plus size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`price-${c.id}`} className="field-label">
                            {fill(w.spaces.price, { unit: c.unit.sv })}
                          </label>
                          <div className="flex items-center gap-2">
                            <input id={`price-${c.id}`} className="field-input max-w-32" inputMode="numeric" value={s.price} onChange={(e) => setSpace(c.id, { price: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
                            <span className="text-muted">kr</span>
                          </div>
                          <button type="button" className="mt-1.5 text-sm font-semibold text-brand underline underline-offset-4" onClick={() => setSpace(c.id, { price: String(suggestedHostPrice(c.id)) })}>
                            {fill(w.spaces.suggested, { price: suggestedHostPrice(c.id) })}
                          </button>
                        </div>
                        {price >= 10 && (
                          <p className="text-sm leading-relaxed text-muted sm:col-span-2">
                            {fill(w.spaces.renterPays, { price: formatKr(renterPrice(price)) })} {fill(w.spaces.youGet, { price: formatKr(hostPayout(price)) })}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {potential > 0 ? (
              <p className="mt-5 rounded-2xl bg-night p-5 text-lg font-semibold text-white">{fill(w.spaces.total, { amount: formatKr(potential) })}</p>
            ) : (
              <p className="mt-5 text-muted">{w.spaces.none}</p>
            )}
          </section>
        )}

        {step === "photos" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.photos.title}</h1>
            <p className="mt-2 leading-relaxed text-muted">{w.photos.lead}</p>
            <label className="mt-6 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper p-6 text-center font-semibold text-night hover:border-night">
              {uploading > 0 ? <Loader2 size={28} className="animate-spin text-brand" aria-hidden="true" /> : <ImagePlus size={28} className="text-brand" aria-hidden="true" />}
              {uploading > 0 ? fill(w.photos.uploading, { n: uploading }) : w.photos.add}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={uploading > 0} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
            {draft.photos.length === 0 ? (
              <p className="mt-4 text-muted">{w.photos.none}</p>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {draft.photos.map((p, i) => (
                  <li key={p.id} className="relative overflow-hidden rounded-2xl border border-line bg-paper">
                    <img src={photoUrl(p.path)} alt="" className="aspect-[4/3] w-full object-cover" />
                    {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-paper/95 px-2.5 py-1 text-xs font-bold text-night">{w.photos.cover}</span>}
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      <div className="flex gap-1">
                        <button type="button" aria-label={w.photos.moveLeft} disabled={i === 0} onClick={() => { const a = [...draft.photos]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; void reorder(a); }} className="flex h-10 w-10 items-center justify-center rounded-full text-night hover:bg-frost disabled:opacity-30">
                          <ArrowLeft size={17} aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={w.photos.moveRight} disabled={i === draft.photos.length - 1} onClick={() => { const a = [...draft.photos]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; void reorder(a); }} className="flex h-10 w-10 items-center justify-center rounded-full text-night hover:bg-frost disabled:opacity-30">
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                        {i > 0 && (
                          <button type="button" aria-label={w.photos.makeCover} onClick={() => void reorder([p, ...draft.photos.filter((x) => x.id !== p.id)])} className="flex h-10 w-10 items-center justify-center rounded-full text-night hover:bg-frost">
                            <Star size={17} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <button type="button" aria-label={w.photos.remove} onClick={() => void removePhoto(p)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#b42318] hover:bg-[#fef3f2]">
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === "text" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.text.title}</h1>
            <p className="mt-2 text-muted">{w.text.lead}</p>
            <div className="mt-6 space-y-5">
              <Field id="title" label={w.text.titleLabel}>
                <input id="title" className="field-input" maxLength={80} value={l.title ?? ""} onChange={(e) => setListing({ title: e.target.value })} />
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  {titleSuggestion && !l.title ? (
                    <button type="button" className="font-semibold text-brand underline underline-offset-4" onClick={() => setListing({ title: titleSuggestion })}>
                      {fill(w.text.suggestion, { title: titleSuggestion })}
                    </button>
                  ) : (
                    <span />
                  )}
                  <span>{(l.title ?? "").length}/80</span>
                </div>
              </Field>
              <Field id="description" label={w.text.description}>
                <textarea id="description" className="field-input resize-y" rows={7} maxLength={2000} placeholder={w.text.descriptionPlaceholder} value={l.description ?? ""} onChange={(e) => setListing({ description: e.target.value })} />
              </Field>
            </div>
          </section>
        )}

        {step === "access" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.access.title}</h1>
            <p className="mt-2 text-muted">{w.access.lead}</p>
            <div className="mt-6 space-y-7">
              <fieldset>
                <legend className="field-label">{w.access.access}</legend>
                <div className="grid gap-2">
                  {ACCESS.map((a) => (
                    <Choice key={a} selected={l.access === a} onClick={() => setListing({ access: a as Access })}>
                      <span>
                        <span className="block">{t.access[a]}</span>
                        <span className="block text-sm font-normal text-muted">{t.accessHints[a]}</span>
                      </span>
                    </Choice>
                  ))}
                </div>
              </fieldset>
              <Field id="access-notes" label={w.access.notes}>
                <input id="access-notes" className="field-input" maxLength={500} placeholder={w.access.notesPlaceholder} value={l.access_notes ?? ""} onChange={(e) => setListing({ access_notes: e.target.value })} />
              </Field>
              <fieldset>
                <legend className="field-label">{w.access.minPeriod}</legend>
                <div className="flex flex-wrap gap-2">
                  {MIN_PERIODS.map((m) => (
                    <Choice key={m} selected={(l.min_period ?? "none") === m} onClick={() => setListing({ min_period: m as MinPeriod })}>
                      {t.minPeriod[m]}
                    </Choice>
                  ))}
                </div>
              </fieldset>
              <Field id="instructions" label={w.access.instructions} hint={w.access.instructionsHint}>
                <textarea id="instructions" className="field-input resize-y" rows={3} maxLength={1000} value={draft.priv.access_instructions ?? ""} onChange={(e) => setPriv({ access_instructions: e.target.value })} />
              </Field>
              <Field id="rules" label={w.access.rules}>
                <textarea id="rules" className="field-input resize-y" rows={3} maxLength={1000} placeholder={w.access.rulesPlaceholder} value={l.rules ?? ""} onChange={(e) => setListing({ rules: e.target.value })} />
              </Field>
            </div>
          </section>
        )}

        {step === "review" && (
          <section>
            <h1 className="mt-1 text-[2rem] leading-tight text-night">{w.review.title}</h1>
            <p className="mt-2 text-muted">{w.review.lead}</p>
            {missing.length > 0 && (
              <div className="mt-6 rounded-2xl bg-[#fff6e5] p-5">
                <p className="font-semibold text-night">{w.review.missing}</p>
                <ul className="mt-2 space-y-1">
                  {missing.map((m) => (
                    <li key={m} className="flex items-center gap-2 text-ink">
                      <X size={16} className="text-[#b42318]" aria-hidden="true" />
                      {w.review.missingLabels[m as keyof typeof w.review.missingLabels]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <nav aria-label="Steg" className="mt-6 flex flex-wrap gap-2">
              {STEPS.slice(0, -1).map((s, i) => (
                <button key={s} type="button" onClick={() => setStep(s)} className="min-h-10 rounded-full border border-line bg-paper px-3.5 text-sm font-semibold text-night hover:border-night">
                  {i + 1}. {w[s].title.replace(/\?$/, "")}
                </button>
              ))}
            </nav>
            <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-snow p-4 sm:p-6 [&_.fixed]:hidden">
              <ListingView
                listing={l as Listing}
                spaces={categories.filter((c) => draft.spaces[c.id].enabled).map((c) => ({ id: c.id, listing_id: id ?? "", category: c.id, capacity: draft.spaces[c.id].capacity, host_price_month: Number(draft.spaces[c.id].price) || 0 }))}
                photos={draft.photos}
                host={null}
                preview
              />
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-[#fef3f2] p-4 text-[0.95rem] font-medium text-[#b42318]">
            {error}
          </p>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-1.5 gap-1 bg-paper px-0">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-full flex-1 ${i <= index ? "bg-night" : "bg-line"}`} />
          ))}
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => go(-1)} disabled={index === 0 || busy} className="min-h-11 px-2 font-semibold text-night underline underline-offset-4 disabled:invisible">
            {t.common.back}
          </button>
          {step === "review" ? (
            isPublished ? (
              <button type="button" onClick={() => router.push("/vard/annonser")} className="btn btn-primary">
                {t.common.save}
              </button>
            ) : (
              <button type="button" onClick={publish} disabled={busy || missing.length > 0} className="btn btn-primary">
                {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                {busy ? w.review.publishing : w.review.publish}
              </button>
            )
          ) : (
            <button type="button" onClick={() => go(1)} disabled={busy || !canContinue} className="btn btn-primary">
              {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {t.common.next}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
