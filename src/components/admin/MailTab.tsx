"use client";

import { useMemo, useState, type FormEvent } from "react";
import { api, townOf, type AdminData } from "./api";

const BATCH = 20;

const templates = {
  sv: {
    subject: "Nu öppnar Spazia i {ort}",
    body: "Hej {namn}!\n\nDu anmälde intresse hos Spazia, och nu öppnar vi i {ort}.\n\nVi hör av oss inom kort med nästa steg. Har du frågor redan nu går det bra att svara på det här mejlet.\n\nHälsningar\nSpazia",
  },
  en: {
    subject: "Spazia is opening in {town}",
    body: "Hi {name},\n\nYou registered your interest with Spazia, and we're now opening in {town}.\n\nWe'll be in touch soon with the next steps. If you have any questions, just reply to this email.\n\nBest wishes\nSpazia",
  },
};

export function MailTab({ data, onChange }: { data: AdminData; onChange: () => Promise<void> }) {
  const towns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of data.leads) counts.set(townOf(l), (counts.get(townOf(l)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.leads]);

  const [town, setTown] = useState(towns[0]?.[0] ?? "");
  const [who, setWho] = useState<"renter" | "host" | "all">("all");
  const [skipSent, setSkipSent] = useState(true);
  const [subjectSv, setSubjectSv] = useState(templates.sv.subject);
  const [bodySv, setBodySv] = useState(templates.sv.body);
  const [subjectEn, setSubjectEn] = useState(templates.en.subject);
  const [bodyEn, setBodyEn] = useState(templates.en.body);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const tag = town;
  const recipients = data.leads.filter(
    (l) =>
      townOf(l) === town &&
      l.data.email &&
      (who === "all" || l.kind === who) &&
      l.meta.status !== "declined" &&
      !(skipSent && l.meta.mailings.some((m) => m.tag === tag)),
  );

  async function send(e: FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) return;
    if (!window.confirm(`Skicka mejlet till ${recipients.length} ${recipients.length === 1 ? "person" : "personer"} i ${town}?`)) return;
    setBusy(true);
    const ids = recipients.map((r) => r.id);
    let done = 0;
    let failed = 0;
    setProgress({ done, total: ids.length, failed });
    for (let i = 0; i < ids.length; i += BATCH) {
      try {
        const res = await api<{ sent: string[]; failed: string[] }>("/mail", {
          method: "POST",
          body: { ids: ids.slice(i, i + BATCH), subject: { sv: subjectSv, en: subjectEn }, body: { sv: bodySv, en: bodyEn }, tag },
        });
        done += res.sent.length;
        failed += res.failed.length;
      } catch {
        failed += Math.min(BATCH, ids.length - i);
      }
      setProgress({ done, total: ids.length, failed });
    }
    setBusy(false);
    await onChange();
  }

  if (!data.mailConfigured) {
    return <p className="card p-5 text-muted">Mejl är inte inställt (SMTP saknas i Netlify), så det går inte att skicka härifrån.</p>;
  }

  return (
    <form onSubmit={send} className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <div className="card h-fit space-y-4 p-5">
        <h2 className="text-2xl text-night">Mottagare</h2>
        <div>
          <label htmlFor="mail-town" className="field-label">
            Ort
          </label>
          <select id="mail-town" className="field-input" value={town} onChange={(e) => setTown(e.target.value)}>
            {towns.map(([t, n]) => (
              <option key={t} value={t}>
                {t} ({n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mail-who" className="field-label">
            Till
          </label>
          <select id="mail-who" className="field-input" value={who} onChange={(e) => setWho(e.target.value as typeof who)}>
            <option value="all">Alla</option>
            <option value="renter">Hyresgäster</option>
            <option value="host">Värdar</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={skipSent} onChange={(e) => setSkipSent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#2f6b75]" />
          <span className="text-[0.95rem] text-ink">Hoppa över de som redan fått ett mejl härifrån om {town || "den här orten"}</span>
        </label>
        <p className="text-[0.95rem] text-muted">
          <span className="font-bold text-night">{recipients.length}</span> {recipients.length === 1 ? "mottagare" : "mottagare"}. De som har status &quot;Inte aktuell&quot; får inget mejl.
        </p>
        {recipients.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-night">Visa mottagare</summary>
            <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-ink">
              {recipients.map((r) => (
                <li key={r.id}>
                  {r.data.first_name} ({r.kind === "host" ? "värd" : "hyresgäst"}, {r.data.lang === "en" ? "engelska" : "svenska"})
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-2xl text-night">Mejl på svenska</legend>
          <p className="text-sm text-muted">
            {"{namn}"} och {"{ort}"} byts ut mot personens namn och ort. Tom rad ger nytt stycke.
          </p>
          <div>
            <label htmlFor="mail-subject-sv" className="field-label">
              Ämne
            </label>
            <input id="mail-subject-sv" className="field-input" value={subjectSv} onChange={(e) => setSubjectSv(e.target.value)} required maxLength={200} />
          </div>
          <div>
            <label htmlFor="mail-body-sv" className="field-label">
              Text
            </label>
            <textarea id="mail-body-sv" className="field-input resize-y" rows={9} value={bodySv} onChange={(e) => setBodySv(e.target.value)} required maxLength={5000} />
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-2xl text-night">Mejl på engelska</legend>
          <p className="text-sm text-muted">Går till de som anmälde sig på den engelska sidan. Lämnar du det tomt får de det svenska mejlet.</p>
          <div>
            <label htmlFor="mail-subject-en" className="field-label">
              Ämne
            </label>
            <input id="mail-subject-en" className="field-input" value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label htmlFor="mail-body-en" className="field-label">
              Text
            </label>
            <textarea id="mail-body-en" className="field-input resize-y" rows={9} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} maxLength={5000} />
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || recipients.length === 0}>
          {busy ? "Skickar …" : `Skicka till ${recipients.length} ${recipients.length === 1 ? "person" : "personer"}`}
        </button>
        {progress && (
          <div role="status">
            <div className="h-2.5 overflow-hidden rounded-full bg-frost">
              <div className="h-full bg-brand transition-all" style={{ width: `${((progress.done + progress.failed) / progress.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-[0.95rem] text-ink">
              {progress.done} av {progress.total} skickade
              {progress.failed > 0 ? `, ${progress.failed} misslyckades` : ""}.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
