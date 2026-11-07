"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Camera, ChevronRight, Loader2, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { appText } from "@/content/app";
import { fetchMyProfile } from "@/lib/app/data";
import type { AppMode } from "@/lib/app/model";
import { MODE_HOME } from "@/lib/app/mode";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner, useAppSession } from "./AppShell";
import { Avatar } from "./ui";

const t = appText.menu;

async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function MenuPage({ mode }: { mode: AppMode }) {
  const session = useAppSession();
  const uid = session.user.id;
  const router = useRouter();
  const { data, loading } = useLoad(() => fetchMyProfile(uid), uid);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", about: "", avatar_url: "" as string | null });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    // Fill the form once the profile has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      first_name: data.profile?.first_name ?? "",
      about: data.profile?.about ?? "",
      avatar_url: data.profile?.avatar_url ?? null,
      last_name: data.priv?.last_name ?? "",
      phone: data.priv?.phone ?? "",
    });
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const db = supabase();
    const [a, b] = await Promise.all([
      db.from("profiles").update({ first_name: form.first_name.trim(), about: form.about.trim() }).eq("id", uid),
      db.from("profile_private").update({ last_name: form.last_name.trim(), phone: form.phone.trim(), updated_at: new Date().toISOString() }).eq("id", uid),
    ]);
    setStatus(a.error || b.error ? "error" : "saved");
  }

  async function changePhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blob = await squareJpeg(file);
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const up = await supabase().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = supabase().storage.from("avatars").getPublicUrl(path).data.publicUrl;
      await supabase().from("profiles").update({ avatar_url: url }).eq("id", uid);
      setForm((f) => ({ ...f, avatar_url: url }));
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
    setUploading(false);
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  if (loading) return <Spinner />;
  const providers = (session.user.app_metadata?.providers as string[] | undefined) ?? [session.user.app_metadata?.provider as string];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-[2rem] leading-tight text-night">{t.title}</h1>

      <form onSubmit={save} className="card space-y-5 p-5">
        <div>
          <h2 className="text-xl font-bold text-night">{t.profile}</h2>
          <p className="mt-1 text-sm text-muted">{mode === "host" ? t.profileHint : t.renter.profileHint}</p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar name={form.first_name} url={form.avatar_url} size={72} />
          <label className="btn btn-secondary cursor-pointer !py-2 text-sm">
            {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
            {t.changePhoto}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void changePhoto(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className="field-label">
              {t.firstName}
            </label>
            <input id="first-name" className="field-input" autoComplete="given-name" maxLength={60} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="last-name" className="field-label">
              {t.lastName}
            </label>
            <input id="last-name" className="field-input" autoComplete="family-name" maxLength={80} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <p className="mt-1.5 text-sm text-muted">{t.lastNameHint}</p>
          </div>
        </div>
        <div>
          <label htmlFor="phone" className="field-label">
            {t.phone}
          </label>
          <input id="phone" className="field-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <p className="mt-1.5 text-sm text-muted">{mode === "host" ? t.phoneHint : t.renter.phoneHint}</p>
        </div>
        <div>
          <label htmlFor="about" className="field-label">
            {t.about}
          </label>
          <textarea id="about" className="field-input resize-y" rows={4} maxLength={1000} placeholder={mode === "host" ? t.aboutPlaceholder : t.renter.aboutPlaceholder} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={status === "saving"} className="btn btn-primary">
            {status === "saving" ? appText.common.saving : appText.common.save}
          </button>
          <span role="status" className="text-sm font-medium text-muted">
            {status === "saved" ? appText.common.saved : status === "error" ? appText.common.error : ""}
          </span>
        </div>
      </form>

      <section className="card p-5">
        <h2 className="text-xl font-bold text-night">{t.account}</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.95rem]">
          <dt className="text-muted">{t.email}</dt>
          <dd className="break-all text-ink">{session.user.email}</dd>
          <dt className="text-muted">Inloggning</dt>
          <dd className="text-ink">{providers.filter(Boolean).map((p) => (p === "email" ? "E-post" : p.charAt(0).toUpperCase() + p.slice(1))).join(", ")}</dd>
        </dl>
      </section>

      {mode === "host" && (
        <section className="card p-5">
          <h2 className="text-xl font-bold text-night">{t.payouts}</h2>
          <p className="mt-2 leading-relaxed text-muted">{t.payoutsText}</p>
        </section>
      )}

      <ul className="card divide-y divide-line">
        <li>
          <Link prefetch={false} href={MODE_HOME[mode === "host" ? "renter" : "host"]} className="flex min-h-14 items-center justify-between px-5 font-semibold text-night">
            <span className="flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-brand" aria-hidden="true" />
              {mode === "host" ? appText.nav.toRenter : appText.nav.toHost}
            </span>
            <ChevronRight size={18} className="text-muted" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <Link prefetch={false} href="/trygghet" className="flex min-h-14 items-center justify-between px-5 font-semibold text-night">
            {t.help}
            <ChevronRight size={18} className="text-muted" aria-hidden="true" />
          </Link>
        </li>
        <li>
          <button type="button" onClick={logout} className="flex min-h-14 w-full items-center gap-2 px-5 font-semibold text-[#b42318]">
            <LogOut size={18} aria-hidden="true" />
            {t.logout}
          </button>
        </li>
      </ul>
    </div>
  );
}
