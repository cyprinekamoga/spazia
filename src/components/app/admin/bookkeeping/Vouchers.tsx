"use client";

import { ArrowLeft, FileText, Paperclip, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { kr } from "@/lib/app/bookkeeping";
import { formatMoment } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { Spinner } from "../../AppShell";
import { acc, ACCEPT_FILES, attachFiles, DataTable, ErrorLine, Money, Note, errorText, openAttachment, today } from "./shared";

interface ListRow {
  id: string;
  label: string;
  date: string;
  description: string;
  source: string;
  total: number;
  accounts: string | null;
  attachments: number;
  corrected_by: string | null;
  corrects: string | null;
}

interface Detail {
  id: string;
  label: string;
  date: string;
  description: string;
  source: string;
  source_ref: string | null;
  created_at: string;
  created_by_email: string;
  corrects: { id: string; label: string } | null;
  corrected_by: { id: string; label: string } | null;
  lines: { account: number; name: string; amount: number; vat_box: string | null; note: string }[];
  attachments: { id: string; path: string; file_name: string; content_type: string; uploaded_at: string }[];
}

const SOURCES: Record<string, string> = { manual: "Manuell", stripe: "Stripe", vat: "Moms", closing: "Bokslut", opening: "Ingående balans" };

function VoucherDetail({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { data, loading, reload } = useLoad(() => acc<Detail | null>("acc_voucher", { p_id: id }), `acc-voucher-${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-muted">Verifikationen hittades inte.</p>;
  const v = data;

  async function addFiles(e: FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      await attachFiles(v.id, files);
      setFiles([]);
      await reload();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  async function correct() {
    const reason = window.prompt(`Rätta ${v.label}: alla rader bokas tillbaka i en ny verifikation (daterad i dag). Varför?`, "");
    if (reason === null) return;
    setBusy(true);
    setError(null);
    try {
      const c = await acc<{ id: string; label: string }>("acc_correct_voucher", { p_voucher: v.id, p_date: today(), p_reason: reason });
      onOpen(c.id);
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  const debit = v.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        Alla verifikationer
      </button>
      <div>
        <h3 className="text-2xl font-bold text-night">
          {v.label} · {v.date}
        </h3>
        <p className="text-lg text-ink">{v.description}</p>
        <p className="mt-1 text-sm text-muted">
          {SOURCES[v.source] ?? v.source} · bokförd {formatMoment(v.created_at)}
          {v.created_by_email ? ` av ${v.created_by_email}` : ""}
          {v.source_ref?.startsWith("stripe:") ? ` · ${v.source_ref.slice(7)}` : ""}
        </p>
      </div>
      {v.corrected_by && (
        <Note tone="warn">
          Rättad av{" "}
          <button type="button" className="font-semibold underline" onClick={() => onOpen(v.corrected_by!.id)}>
            {v.corrected_by.label}
          </button>
          .
        </Note>
      )}
      {v.corrects && (
        <Note>
          Rättar{" "}
          <button type="button" className="font-semibold underline" onClick={() => onOpen(v.corrects!.id)}>
            {v.corrects.label}
          </button>
          .
        </Note>
      )}
      <DataTable
        head={["Konto", "Debet", "Kredit", "Momsruta", "Anteckning"]}
        align={["left", "right", "right", "left", "left"]}
        rows={v.lines.map((l) => [
          `${l.account} ${l.name}`,
          l.amount > 0 ? <Money key="d" value={l.amount} /> : "",
          l.amount < 0 ? <Money key="c" value={-l.amount} /> : "",
          l.vat_box ?? "",
          l.note,
        ])}
        foot={["Summa", kr(debit), kr(debit), "", ""]}
      />

      <section className="card space-y-3 p-4">
        <h4 className="flex items-center gap-1.5 font-bold text-night">
          <Paperclip size={18} aria-hidden="true" />
          Underlag
        </h4>
        {v.attachments.length === 0 ? (
          <p className="text-[0.95rem] text-muted">{v.source === "manual" ? "Inget underlag än." : "Underlaget finns hos Stripe (transaktionen ovan) eller är verifikationen själv."}</p>
        ) : (
          <ul className="space-y-1">
            {v.attachments.map((a) => (
              <li key={a.id}>
                <button type="button" className="flex min-h-11 items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline" onClick={() => openAttachment(a.path).catch((e) => setError(errorText(e)))}>
                  <FileText size={18} aria-hidden="true" />
                  {a.file_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addFiles} className="flex flex-wrap items-center gap-2">
          <input type="file" multiple accept={ACCEPT_FILES} aria-label="Välj underlag" className="text-sm" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <button type="submit" disabled={busy || !files.length} className="btn btn-secondary">
            Lägg till underlag
          </button>
        </form>
      </section>
      <ErrorLine text={error} />
      {!v.corrected_by && !["vat", "closing", "opening"].includes(v.source) && (
        <div>
          <button type="button" disabled={busy} onClick={correct} className="btn text-[#b42318] hover:bg-[#fef3f2]">
            Rätta verifikationen
          </button>
          <p className="mt-1 text-sm text-muted">En bokförd verifikation kan inte ändras eller tas bort. Rättelsen bokar tillbaka allt; bokför sedan det rätta som en ny verifikation.</p>
        </div>
      )}
    </div>
  );
}

export function Vouchers({ year, openId, onOpen }: { year: number; openId: string | null; onOpen: (id: string | null) => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, loading } = useLoad(() => acc<ListRow[]>("acc_vouchers", { p_year: year, p_search: query, p_limit: 500 }), `acc-vouchers-${year}-${query}`);

  if (openId) return <VoucherDetail key={openId} id={openId} onBack={() => onOpen(null)} onOpen={onOpen} />;

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
        className="flex max-w-md gap-2"
      >
        <input className="field-input" placeholder="Sök text, konto eller nummer (A12)" aria-label="Sök verifikationer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn btn-secondary" aria-label="Sök">
          <Search size={18} aria-hidden="true" />
        </button>
      </form>
      {loading ? (
        <Spinner />
      ) : (data ?? []).length === 0 ? (
        <p className="text-muted">Inga verifikationer {query ? "som matchar" : `för ${year}`}.</p>
      ) : (
        <DataTable
          head={["Nr", "Datum", "Text", "Belopp", "Konton", ""]}
          align={["left", "left", "left", "right", "left", "left"]}
          rows={(data ?? []).map((v) => [
            <button key="n" type="button" className="font-bold text-brand underline-offset-4 hover:underline" onClick={() => onOpen(v.id)}>
              {v.label}
            </button>,
            v.date,
            <span key="t" className={v.corrected_by ? "text-muted line-through" : ""}>
              {v.description}
            </span>,
            <Money key="m" value={v.total} />,
            <span key="a" className="text-muted">
              {v.accounts}
            </span>,
            <span key="s" className="whitespace-nowrap text-muted">
              {v.attachments > 0 ? `📎 ${v.attachments}` : v.source === "manual" && !v.corrected_by && !v.corrects ? <span className="text-[#8a5a00]">Underlag saknas</span> : SOURCES[v.source]}
            </span>,
          ])}
        />
      )}
    </div>
  );
}
