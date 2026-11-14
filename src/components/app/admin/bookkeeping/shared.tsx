"use client";

import type { ReactNode } from "react";
import { kr } from "@/lib/app/bookkeeping";
import { supabase } from "@/lib/supabase";

/** The bookkeeping functions in the database (team only). */
export async function acc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await supabase().rpc(name, args);
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const ERRORS: Record<string, string> = {
  unbalanced: "Debet och kredit är inte lika stora.",
  unknown_account: "Ett konto finns inte, eller är avstängt.",
  two_lines_required: "En verifikation behöver minst två rader.",
  zero_amount: "En rad saknar belopp.",
  description_required: "Skriv vad verifikationen gäller.",
  date_required: "Välj ett datum.",
  period_locked: "Datumet ligger i en låst period (momsen är redovisad eller året stängt). Välj ett datum i en öppen period.",
  future_date: "Datumet ligger i framtiden.",
  already_corrected: "Verifikationen är redan rättad.",
  not_correctable: "Moms- och bokslutsverifikationer kan inte rättas här.",
  file_missing: "Filen kom inte upp. Försök igen.",
  bad_path: "Filen hamnade fel. Försök igen.",
  already_settled: "Perioden är redan redovisad.",
  period_not_over: "Perioden är inte slut än.",
  earlier_period_open: "Redovisa tidigare perioder först.",
  already_closed: "Året är redan stängt.",
  year_not_over: "Året är inte slut än.",
  earlier_year_open: "Stäng tidigare år först.",
  vat_not_settled: "Redovisa momsen för årets alla perioder först.",
  bad_period: "Okänd period.",
  forbidden: "Bara Spazias team har tillgång till bokföringen.",
  not_found: "Hittades inte.",
};

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return ERRORS[msg] ?? msg ?? "Något gick fel.";
}

export function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return <span className={`tabular-nums whitespace-nowrap ${strong ? "font-bold" : ""} ${value < 0 ? "text-[#b42318]" : ""}`}>{kr(value)}</span>;
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-[#fef3f2] p-3 text-sm font-medium text-[#b42318]">
      {text}
    </p>
  );
}

export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "good" }) {
  const cls = { neutral: "bg-frost text-ink", warn: "bg-[#fff4e0] text-[#8a5a00]", good: "bg-[#e7f4ec] text-[#1f6b3a]" }[tone];
  return <div className={`rounded-xl p-3 text-[0.95rem] ${cls}`}>{children}</div>;
}

export function DataTable({ head, rows, foot, align }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; align?: ("left" | "right")[] }) {
  const cls = (i: number) => (align?.[i] === "right" ? "text-right" : "text-left");
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((h, i) => (
              <th key={h + i} className={`px-3 py-2 font-semibold ${cls(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 align-top text-night ${cls(j)}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t-2 border-line font-bold">
              {foot.map((c, j) => (
                <td key={j} className={`px-3 py-2 text-night ${cls(j)}`}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Save bytes or text as a file in the browser. */
export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());

/** Upload receipts for a voucher and register them. */
export async function attachFiles(voucherId: string, files: File[]): Promise<void> {
  for (const f of files) {
    const safe = f.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "underlag";
    const path = `${voucherId}/${crypto.randomUUID()}-${safe}`;
    const up = await supabase().storage.from("bookkeeping").upload(path, f, { contentType: f.type || undefined, upsert: false });
    if (up.error) throw new Error(up.error.message);
    await acc("acc_add_attachment", { p_voucher: voucherId, p_path: path, p_name: f.name, p_type: f.type, p_size: f.size });
  }
}

export async function openAttachment(path: string) {
  const res = await supabase().storage.from("bookkeeping").createSignedUrl(path, 300);
  if (res.error || !res.data) throw new Error(res.error?.message ?? "file");
  window.open(res.data.signedUrl, "_blank", "noopener");
}

export const ACCEPT_FILES = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
