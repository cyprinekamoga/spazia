"use client";

import { Paperclip, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { kr, lineSum, PAY_ACCOUNTS, r2, templateLines, TEMPLATES, VAT_BOXES, type Account, type TemplateId, type VoucherLine } from "@/lib/app/bookkeeping";
import { acc, ACCEPT_FILES, attachFiles, DataTable, ErrorLine, Money, Note, errorText, today } from "./shared";

const BASE_BOXES = ["05", "06", "07", "08", "20", "21", "22", "23", "24", "35", "36", "39", "40", "41", "42", "50"];

const parseAmount = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? r2(n) : NaN;
};

interface FreeRow {
  account: number;
  debit: string;
  credit: string;
  vat_box: string;
  note: string;
}

export interface Prefill {
  date?: string;
  description?: string;
  amount?: number;
  /** A Stripe transaction from the "to book" list: marked as booked afterwards. */
  unbookedTxn?: string;
}

function AccountSelect({ id, accounts, value, onChange, range }: { id: string; accounts: Account[]; value: number; onChange: (n: number) => void; range?: [number, number] }) {
  const list = accounts.filter((a) => a.active && (!range || (a.number >= range[0] && a.number <= range[1])));
  return (
    <select id={id} className="field-input" value={value || ""} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="">Välj konto</option>
      {list.map((a) => (
        <option key={a.number} value={a.number}>
          {a.number} {a.name}
        </option>
      ))}
    </select>
  );
}

export function VoucherForm({ accounts, prefill, onSaved }: { accounts: Account[]; prefill?: Prefill; onSaved: (label: string, id: string) => void }) {
  const [template, setTemplate] = useState<TemplateId>(prefill?.unbookedTxn ? "free" : "purchase25");
  const t = TEMPLATES.find((x) => x.id === template)!;
  const [date, setDate] = useState(prefill?.date ?? today());
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [amount, setAmount] = useState(prefill?.amount != null ? String(Math.abs(prefill.amount)).replace(".", ",") : "");
  const [account, setAccount] = useState<number>(t.defaultAccount ?? 0);
  const [pay, setPay] = useState<number>(t.payDefault);
  const [rows, setRows] = useState<FreeRow[]>(() =>
    prefill?.unbookedTxn && prefill.amount
      ? [
          { account: 1580, debit: prefill.amount > 0 ? String(prefill.amount).replace(".", ",") : "", credit: prefill.amount < 0 ? String(-prefill.amount).replace(".", ",") : "", vat_box: "", note: "" },
          { account: 0, debit: "", credit: "", vat_box: "", note: "" },
        ]
      : [
          { account: 0, debit: "", credit: "", vat_box: "", note: "" },
          { account: 0, debit: "", credit: "", vat_box: "", note: "" },
        ],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTemplate(id: TemplateId) {
    const next = TEMPLATES.find((x) => x.id === id)!;
    setTemplate(id);
    if (next.defaultAccount) setAccount(next.defaultAccount);
    setPay(next.payDefault);
  }

  const lines: VoucherLine[] = useMemo(() => {
    if (template === "free") {
      return rows
        .map((r) => {
          const d = r.debit ? parseAmount(r.debit) : 0;
          const c = r.credit ? parseAmount(r.credit) : 0;
          return { account: r.account, amount: r2((d || 0) - (c || 0)), ...(r.vat_box ? { vat_box: r.vat_box } : {}), ...(r.note.trim() ? { note: r.note.trim() } : {}) };
        })
        .filter((l) => l.account && l.amount !== 0);
    }
    const g = parseAmount(amount);
    return Number.isFinite(g) && g > 0 && (t.pick === null || account) ? templateLines(template, g, account, pay) : [];
  }, [template, rows, amount, account, pay, t.pick]);

  const diff = lineSum(lines);
  const name = (n: number) => accounts.find((a) => a.number === n)?.name ?? "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length < 2) return setError("Fyll i belopp och konton.");
    if (diff !== 0) return setError(`Debet och kredit skiljer ${kr(diff)} kr.`);
    setBusy(true);
    try {
      const v = await acc<{ id: string; label: string }>("acc_create_voucher", { p_date: date, p_description: description.trim(), p_lines: lines });
      if (files.length) await attachFiles(v.id, files);
      if (prefill?.unbookedTxn) await acc("acc_resolve_unbooked", { p_txn: prefill.unbookedTxn, p_voucher: v.id, p_note: `Bokförd som ${v.label}` });
      onSaved(v.label, v.id);
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card space-y-4 p-4">
        <div>
          <label htmlFor="v-template" className="field-label">
            Vad gäller det?
          </label>
          <select id="v-template" className="field-input" value={template} onChange={(e) => pickTemplate(e.target.value as TemplateId)}>
            {TEMPLATES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted">{t.hint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div>
            <label htmlFor="v-date" className="field-label">
              Datum
            </label>
            <input id="v-date" type="date" className="field-input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="v-text" className="field-label">
              Text
            </label>
            <input id="v-text" className="field-input" maxLength={250} placeholder="Till exempel: Telia, mobilabonnemang oktober" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
        </div>

        {template !== "free" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="v-amount" className="field-label">
                {template === "vat_payment" ? "Belopp" : "Belopp inklusive moms"}
              </label>
              <input id="v-amount" className="field-input tabular-nums" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            {t.pick && (
              <div>
                <label htmlFor="v-account" className="field-label">
                  {t.pick === "cost" ? "Kostnadskonto" : "Intäktskonto"}
                </label>
                <AccountSelect id="v-account" accounts={accounts} value={account} onChange={setAccount} range={t.pick === "cost" ? [4000, 8999] : [3000, 3999]} />
              </div>
            )}
            <div>
              <label htmlFor="v-pay" className="field-label">
                {t.payLabel}
              </label>
              <select id="v-pay" className="field-input" value={pay} onChange={(e) => setPay(Number(e.target.value))}>
                {PAY_ACCOUNTS.filter((p) => template === "vat_payment" || p.number !== 1630).map((p) => (
                  <option key={p.number} value={p.number}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_7rem_7rem_6rem_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <AccountSelect id={`row-acc-${i}`} accounts={accounts} value={r.account} onChange={(n) => setRows(rows.map((x, j) => (j === i ? { ...x, account: n } : x)))} />
                </div>
                <input aria-label="Debet" className="field-input tabular-nums" inputMode="decimal" placeholder="Debet" value={r.debit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x)))} />
                <input aria-label="Kredit" className="field-input tabular-nums" inputMode="decimal" placeholder="Kredit" value={r.credit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x)))} />
                <select aria-label="Momsruta" className="field-input" value={r.vat_box} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, vat_box: e.target.value } : x)))}>
                  <option value="">Ruta</option>
                  {BASE_BOXES.map((b) => (
                    <option key={b} value={b} title={VAT_BOXES[b]}>
                      {b}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label="Ta bort raden" disabled={rows.length <= 2} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-frost disabled:opacity-30">
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => setRows([...rows, { account: 0, debit: "", credit: "", vat_box: "", note: "" }])}>
              <Plus size={18} aria-hidden="true" />
              Lägg till rad
            </button>
          </div>
        )}

        <div>
          <label htmlFor="v-files" className="field-label flex items-center gap-1.5">
            <Paperclip size={16} aria-hidden="true" />
            Underlag (kvitto eller faktura)
          </label>
          <input id="v-files" type="file" multiple accept={ACCEPT_FILES} className="block w-full text-sm" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <p className="mt-1 text-sm text-muted">Foto eller PDF, högst 15 MB. Underlaget sparas för alltid tillsammans med verifikationen.</p>
        </div>
      </div>

      {lines.length > 0 && (
        <DataTable
          head={["Konto", "Debet", "Kredit", "Momsruta"]}
          align={["left", "right", "right", "left"]}
          rows={lines.map((l) => [
            `${l.account} ${name(l.account)}`,
            l.amount > 0 ? <Money key="d" value={l.amount} /> : "",
            l.amount < 0 ? <Money key="c" value={-l.amount} /> : "",
            l.vat_box ?? accounts.find((a) => a.number === l.account)?.vat_box ?? "",
          ])}
          foot={["Summa", kr(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)), kr(-lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0)), diff === 0 ? "Balanserar" : `Diff ${kr(diff)}`]}
        />
      )}
      {files.length === 0 && template !== "free" && (
        <Note tone="warn">Inget underlag än. Enligt bokföringslagen ska varje verifikation ha ett underlag. Du kan också lägga till det efteråt.</Note>
      )}
      <ErrorLine text={error} />
      <button type="submit" disabled={busy || lines.length < 2 || diff !== 0} className="btn btn-primary">
        {busy ? "Bokför…" : "Bokför"}
      </button>
    </form>
  );
}
