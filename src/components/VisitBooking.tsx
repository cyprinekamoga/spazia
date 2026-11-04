"use client";

import { CalendarCheck2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dictionary } from "@/content";
import { fill, type Lang } from "@/lib/i18n";
import { formatDay, formatSlot, formatTime, stockholmDate } from "@/lib/time";
import { trackVisitBooked } from "@/lib/tracking";

interface SlotInfo {
  id: string;
  start: string;
  end: string;
}

interface BookingInfo extends Omit<SlotInfo, "id"> {
  slotId: string;
  address: string;
  phone: string;
  note: string;
}

interface Status {
  available: boolean;
  name: string;
  phone?: string;
  slots: SlotInfo[];
  booking: BookingInfo | null;
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: Status };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchStatus(ref: string): Promise<{ ok: true; data: Status } | { ok: false; code: string }> {
  // A brand-new registration can take a few seconds to be stored: retry on 404.
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`/api/visits?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
    if (res.ok) return { ok: true, data: (await res.json()) as Status };
    if (res.status !== 404) return { ok: false, code: res.status === 400 ? "bad_ref" : "generic" };
    await sleep(1500);
  }
  return { ok: false, code: "unknown_ref" };
}

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

/**
 * Lets a host in Luleå pick a visit time, and later change or cancel it.
 * `leadRef` is the registration's private id (from the form or the email link).
 */
export function VisitBooking({ lang, t, leadRef, initialPhone = "" }: { lang: Lang; t: Dictionary; leadRef: string | null; initialPhone?: string }) {
  const v = t.visitBooking;
  const [load, setLoad] = useState<Load>(() => (leadRef ? { state: "loading" } : { state: "error", message: v.missingRef }));
  const [selected, setSelected] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ address?: string; phone?: string }>({});

  const refresh = useCallback(async () => {
    if (!leadRef) return;
    const result = await fetchStatus(leadRef);
    if (!result.ok) {
      setLoad({ state: "error", message: result.code === "generic" ? v.errors.generic : v.unknownRef });
      return;
    }
    setLoad({ state: "ready", data: result.data });
    const b = result.data.booking;
    setAddress((a) => a || b?.address || "");
    setPhone((p) => p || b?.phone || result.data.phone || "");
    setNote((n) => n || b?.note || "");
  }, [leadRef, v]);

  useEffect(() => {
    // Loading data from the API on mount; the state updates happen after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const days = useMemo(() => {
    if (load.state !== "ready") return [];
    const groups = new Map<string, SlotInfo[]>();
    for (const s of load.data.slots) {
      const key = stockholmDate(s.start);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.values()];
  }, [load]);

  if (load.state === "loading") {
    return (
      <p className="flex items-center gap-2 text-muted" role="status">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        {v.loading}
      </p>
    );
  }
  if (load.state === "error") return <p className="leading-relaxed text-muted">{load.message}</p>;

  const { data } = load;
  if (!data.available) return <p className="leading-relaxed text-muted">{v.notAvailable}</p>;

  const selectedSlot = data.slots.find((s) => s.id === selected) ?? null;

  async function book(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !leadRef) return;
    const errs = {
      address: address.trim().length < 4 ? v.errors.address : undefined,
      phone: !/^[+\d][\d\s()-]{5,24}$/.test(phone.trim()) ? v.errors.phone : undefined,
    };
    setFieldErrors(errs);
    if (errs.address || errs.phone) return;
    setBusy(true);
    setMessage(null);
    const res = await post("/api/visits/book", { ref: leadRef, slotId: selectedSlot.id, address, phone, note });
    setBusy(false);
    if (res.status === 200) {
      trackVisitBooked();
      setChanging(false);
      setSelected(null);
      await refresh();
      return;
    }
    const code = String(res.json.error ?? "");
    const errors = v.errors as Record<string, string>;
    setMessage({ tone: "error", text: errors[code] ?? v.errors.generic });
    if (code === "slot_taken" || code === "slot_gone") {
      setSelected(null);
      await refresh();
    }
  }

  async function cancel() {
    if (!leadRef || !window.confirm(v.cancelConfirm)) return;
    setBusy(true);
    const res = await post("/api/visits/cancel", { ref: leadRef });
    setBusy(false);
    if (res.status !== 200) {
      setMessage({ tone: "error", text: v.errors.generic });
      return;
    }
    setMessage({ tone: "info", text: v.cancelled });
    setChanging(false);
    await refresh();
  }

  const messageBox = message && (
    <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl p-4 text-[0.95rem] font-medium ${message.tone === "error" ? "bg-[#fef3f2] text-[#b42318]" : "bg-frost text-night"}`}>
      {message.text}
    </p>
  );

  if (data.booking && !changing) {
    const when = formatSlot(data.booking.start, lang);
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CalendarCheck2 size={28} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-night">{v.bookedTitle}</p>
            <p className="mt-1 leading-relaxed text-muted">{fill(v.bookedText, { when })}</p>
            <p className="mt-2 text-[0.95rem] text-ink">{data.booking.address}</p>
          </div>
        </div>
        {messageBox}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-secondary" onClick={() => setChanging(true)} disabled={busy}>
            {v.change}
          </button>
          <button type="button" className="btn text-[#b42318] hover:bg-[#fef3f2]" onClick={cancel} disabled={busy}>
            {v.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left">
      {data.name && <p className="font-semibold text-night">{fill(v.hello, { name: data.name })}</p>}
      {messageBox}
      {days.length === 0 ? (
        <p className="leading-relaxed text-muted">{v.noSlots}</p>
      ) : (
        <fieldset>
          <legend className="field-label">{v.pickTime}</legend>
          <div className="space-y-4">
            {days.map((slots) => (
              <div key={slots[0].id}>
                <p className="text-sm font-semibold text-muted first-letter:uppercase">{formatDay(slots[0].start, lang)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={selected === s.id}
                      onClick={() => setSelected(s.id)}
                      className="min-h-11 rounded-full border-[1.5px] border-line bg-paper px-4 py-2 font-semibold text-ink transition-colors hover:border-frost-2 aria-pressed:border-night aria-pressed:bg-night aria-pressed:text-white"
                    >
                      {formatTime(s.start, lang)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {data.booking && !selectedSlot && (
        <button type="button" className="btn btn-secondary" onClick={() => setChanging(false)}>
          {v.keepTime}
        </button>
      )}

      {selectedSlot && (
        <form onSubmit={book} noValidate className="space-y-4">
          <div>
            <label htmlFor="visit-address" className="field-label">
              {v.address}
            </label>
            <input
              id="visit-address"
              className="field-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              maxLength={200}
              aria-invalid={fieldErrors.address ? true : undefined}
              aria-describedby="visit-address-hint"
            />
            <p id="visit-address-hint" className={`mt-1.5 text-sm ${fieldErrors.address ? "font-medium text-[#b42318]" : "text-muted"}`}>
              {fieldErrors.address ?? v.addressHint}
            </p>
          </div>
          <div>
            <label htmlFor="visit-phone" className="field-label">
              {v.phone}
            </label>
            <input
              id="visit-phone"
              className="field-input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={40}
              aria-invalid={fieldErrors.phone ? true : undefined}
              aria-describedby="visit-phone-hint"
            />
            <p id="visit-phone-hint" className={`mt-1.5 text-sm ${fieldErrors.phone ? "font-medium text-[#b42318]" : "text-muted"}`}>
              {fieldErrors.phone ?? v.phoneHint}
            </p>
          </div>
          <div>
            <label htmlFor="visit-note" className="field-label">
              {v.note}
            </label>
            <textarea
              id="visit-note"
              className="field-input resize-y"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={v.notePlaceholder}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? v.submitting : fill(v.submit, { time: formatSlot(selectedSlot.start, lang) })}
            </button>
            {data.booking && (
              <button type="button" className="btn btn-secondary" onClick={() => setChanging(false)} disabled={busy}>
                {v.keepTime}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
