"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const t = appText.deleteAccount;

interface Status {
  mode: "delete" | "anonymise";
  ok: boolean;
  blockers: { pending_requests: number; active_rentals: number; open_payments: number };
}

/** Every file the user uploaded to a folder of their own (listing photos sit one level down). */
async function ownFiles(bucket: string, uid: string): Promise<string[]> {
  const store = supabase().storage.from(bucket);
  const top = await store.list(uid, { limit: 1000 });
  if (top.error) throw top.error;
  const paths: string[] = [];
  for (const entry of top.data ?? []) {
    if (entry.id) {
      paths.push(`${uid}/${entry.name}`);
    } else {
      const inner = await store.list(`${uid}/${entry.name}`, { limit: 1000 });
      if (inner.error) throw inner.error;
      for (const f of inner.data ?? []) if (f.id) paths.push(`${uid}/${entry.name}/${f.name}`);
    }
  }
  return paths;
}

async function removeOwnPhotos(uid: string) {
  for (const bucket of ["listing-photos", "avatars"]) {
    const paths = await ownFiles(bucket, uid);
    for (let i = 0; i < paths.length; i += 100) {
      const res = await supabase().storage.from(bucket).remove(paths.slice(i, i + 100));
      if (res.error) throw res.error;
    }
  }
}

/** Menu → Delete account: checks what is still open, explains what happens, asks to type a word. */
export function DeleteAccount({ uid, onDeleted }: { uid: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setStatus(null);
    setError(null);
    setWord("");
    const { data, error: err } = await supabase().rpc("account_deletion_status");
    if (err) setError(appText.common.error);
    else setStatus(data as Status);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const check = await supabase().rpc("account_deletion_status");
      if (check.error) throw check.error;
      if (!(check.data as Status).ok) {
        setStatus(check.data as Status);
        setError(t.busy);
        return;
      }
      await removeOwnPhotos(uid);
      const { error: err } = await supabase().rpc("delete_my_account");
      if (err) {
        setError(err.message.includes("account_busy") ? t.busy : appText.common.error);
        return;
      }
      onDeleted();
    } catch (e) {
      console.error(e);
      setError(appText.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={start} className="mx-auto flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted underline-offset-4 hover:text-[#b42318] hover:underline">
        <Trash2 size={16} aria-hidden="true" />
        {t.open}
      </button>
    );
  }

  const b = status?.blockers;
  return (
    <section className="card border-[#f3c5c0] p-5" aria-labelledby="delete-title">
      <h2 id="delete-title" className="flex items-center gap-2 text-xl font-bold text-[#b42318]">
        <Trash2 size={20} aria-hidden="true" />
        {t.title}
      </h2>
      {!status && !error && <p className="mt-2 text-muted">{t.checking}</p>}
      {status && !status.ok && b && (
        <>
          <p className="mt-2 font-semibold text-night">{t.blocked}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
            {b.pending_requests > 0 && <li>{fill(t.pendingRequests, { n: String(b.pending_requests) })}</li>}
            {b.active_rentals > 0 && <li>{fill(t.activeRentals, { n: String(b.active_rentals) })}</li>}
            {b.open_payments > 0 && <li>{fill(t.openPayments, { n: String(b.open_payments) })}</li>}
          </ul>
        </>
      )}
      {status?.ok && (
        <>
          <p className="mt-2 leading-relaxed text-ink">{status.mode === "delete" ? t.deleteText : t.anonymiseText}</p>
          {status.mode === "anonymise" && <p className="mt-2 text-sm leading-relaxed text-muted">{t.keptText}</p>}
          <label htmlFor="delete-word" className="field-label mt-4">
            {t.confirmLabel}
          </label>
          <input id="delete-word" className="field-input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {status?.ok && (
          <button
            type="button"
            disabled={busy || word.trim().toUpperCase() !== t.confirmWord}
            onClick={remove}
            className="btn bg-[#b42318] text-white hover:bg-[#912018] disabled:opacity-50"
          >
            <Trash2 size={18} aria-hidden="true" />
            {busy ? t.working : t.confirm}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn btn-secondary">
          {t.cancel}
        </button>
      </div>
    </section>
  );
}
