"use client";

import { Download, Lock } from "lucide-react";
import { useState } from "react";
import { kr, neBasis, periodLabel, sieFile, toCp437, VAT_BOXES, type Balance, type SieData } from "@/lib/app/bookkeeping";
import { useLoad } from "@/lib/app/session";
import { site } from "@/lib/site";
import { Spinner } from "../../AppShell";
import { acc, DataTable, download, ErrorLine, Money, Note, errorText, today } from "./shared";

interface PeriodRow {
  period: string;
  settled: boolean;
  to: string;
}

interface VatReport {
  period: string;
  from: string;
  to: string;
  exact: Record<string, number>;
  boxes: Record<string, number>;
  settled_at: string | null;
  voucher: { id: string; label: string } | null;
}

const BOX_ORDER = ["05", "06", "07", "08", "10", "11", "12", "20", "21", "22", "23", "24", "30", "31", "32", "35", "36", "39", "40", "41", "42", "48", "50", "60", "61", "62", "49"];

function VatPeriod({ period, onChanged }: { period: PeriodRow; onChanged: () => void }) {
  const { data, loading, reload } = useLoad(() => acc<VatReport>("acc_vat_report", { p_period: period.period }), `acc-vat-${period.period}-${period.settled}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading) return <Spinner />;
  if (!data) return null;
  const boxes = BOX_ORDER.filter((b) => b === "49" || (data.boxes[b] ?? 0) !== 0);
  const due = data.boxes["49"] ?? 0;
  const over = period.to < today();

  async function settle() {
    if (!window.confirm(`Bokför momsredovisningen för ${periodLabel(period.period)} och lås perioden? Inget mer kan sedan bokföras med datum i perioden.`)) return;
    setBusy(true);
    setError(null);
    try {
      await acc("acc_vat_settle", { p_period: period.period });
      await reload();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <DataTable
        head={["Ruta", "", "Exakt", "Att fylla i"]}
        align={["left", "left", "right", "right"]}
        rows={boxes.map((b) => [
          <span key="b" className="font-bold">
            {b}
          </span>,
          VAT_BOXES[b] ?? "",
          b === "49" ? "" : <Money key="e" value={data.exact[b] ?? 0} />,
          <Money key="f" value={data.boxes[b] ?? 0} strong={b === "49"} />,
        ])}
      />
      <Note tone={due > 0 ? "warn" : "neutral"}>
        {due > 0 ? `Att betala till Skatteverket: ${kr(due)} kr.` : due < 0 ? `Att få tillbaka från Skatteverket: ${kr(-due)} kr.` : "Ingen moms att betala för perioden."} Fyll i rutorna i momsdeklarationen på Skatteverkets e-tjänst (hela kronor) och betala in till skattekontot senast den dag Skatteverket anger.
      </Note>
      {data.settled_at ? (
        <p className="flex items-center gap-2 text-[0.95rem] text-ink">
          <Lock size={16} aria-hidden="true" />
          Redovisad och låst{data.voucher ? ` (verifikation ${data.voucher.label})` : ""}. Bokför betalningen till Skatteverket med mallen ”Betalning av moms”.
        </p>
      ) : over ? (
        <button type="button" disabled={busy} onClick={settle} className="btn btn-primary">
          Bokför momsredovisningen och lås perioden
        </button>
      ) : (
        <p className="text-sm text-muted">Perioden pågår. När den är slut kan du redovisa den här.</p>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

export function Vat({ year }: { year: number }) {
  const periods = useLoad(() => acc<PeriodRow[]>("acc_vat_periods", { p_year: year }), `acc-vat-periods-${year}`);
  const [open, setOpen] = useState<string | null>(null);
  if (periods.loading) return <Spinner />;
  const list = periods.data ?? [];
  const current = open ?? list.find((p) => !p.settled && p.to < today())?.period ?? list.find((p) => !p.settled)?.period ?? list[list.length - 1]?.period;
  const row = list.find((p) => p.period === current);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {list.map((p) => (
          <button key={p.period} type="button" onClick={() => setOpen(p.period)} aria-pressed={p.period === current} className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.95rem] font-semibold text-muted hover:bg-frost aria-pressed:bg-frost aria-pressed:text-night">
            {p.settled && <Lock size={14} aria-hidden="true" />}
            {periodLabel(p.period).replace(/ \(.*\)$/, "")}
          </button>
        ))}
      </div>
      {row && (
        <>
          <h3 className="text-xl font-bold text-night">{periodLabel(row.period)}</h3>
          <VatPeriod key={row.period} period={row} onChanged={periods.reload} />
        </>
      )}
    </div>
  );
}

export function YearEnd({ year, closed, onChanged }: { year: number; closed: boolean; onChanged: () => void }) {
  const balances = useLoad(() => acc<Balance[]>("acc_balances", { p_from: `${year}-01-01`, p_to: `${year}-12-31` }), `acc-year-${year}-${closed}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const over = `${year}-12-31` < today();

  async function exportSie() {
    setBusy(true);
    setError(null);
    try {
      const data = await acc<SieData>("acc_sie", { p_year: year });
      const text = sieFile(data, { name: site.legalName, orgNumber: site.orgNumber }, today());
      download(`spazia-bokforing-${year}.se`, toCp437(text), "application/octet-stream");
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  async function close() {
    if (!window.confirm(`Stäng ${year}? Årets resultat bokförs mot eget kapital och inget mer kan bokföras på ${year}. Det går inte att ångra.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await acc<{ result: number }>("acc_close_year", { p_year: year });
      setDone(`${year} är stängt. Årets resultat: ${kr(r.result)} kr.`);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  const ne = neBasis(balances.data ?? []);
  return (
    <div className="space-y-6">
      <section className="card space-y-2 p-4">
        <h3 className="text-xl font-bold text-night">Export (SIE 4)</h3>
        <p className="text-[0.95rem] text-ink">Hela årets bokföring i standardformatet som redovisningsbyråer, Skatteverket och andra bokföringsprogram läser. Spara en kopia varje år: bokföringen ska finnas kvar i sju år.</p>
        <button type="button" disabled={busy} onClick={exportSie} className="btn btn-secondary">
          <Download size={18} aria-hidden="true" />
          Ladda ner SIE-fil för {year}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-xl font-bold text-night">Underlag för NE-bilagan {year}</h3>
        <p className="text-[0.95rem] text-muted">Beloppen ur bokföringen, att föra in i NE-bilagan i inkomstdeklarationen. Skattemässiga justeringar (till exempel ej avdragsgill representation) görs i deklarationen.</p>
        {balances.loading ? (
          <Spinner />
        ) : (
          <>
            <DataTable head={["Ruta", "", "Belopp"]} align={["left", "left", "right"]} rows={ne.result.map((r) => [<span key="b" className="font-bold">{r.box}</span>, r.label, <Money key="m" value={r.amount} strong={r.box === "R11"} />])} />
            <DataTable head={["Balansräkning per 31 december", "Belopp"]} align={["left", "right"]} rows={ne.balance.filter((b) => b.amount !== 0).map((b) => [b.label, <Money key="m" value={b.amount} />])} />
          </>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h3 className="text-xl font-bold text-night">Bokslut</h3>
        {closed ? (
          <p className="flex items-center gap-2 text-[0.95rem] text-ink">
            <Lock size={16} aria-hidden="true" />
            {year} är stängt.
          </p>
        ) : over ? (
          <>
            <p className="text-[0.95rem] text-ink">
              När alla verifikationer för {year} är bokförda och momsen för årets perioder är redovisad: stäng året. Resultatet bokförs på 2019, året låses, och den 1 januari {year + 1} förs resultatet och privata uttag och insättningar över till eget kapital (2010).
            </p>
            <button type="button" disabled={busy} onClick={close} className="btn btn-primary">
              Stäng {year}
            </button>
          </>
        ) : (
          <p className="text-[0.95rem] text-muted">Året pågår. Bokslutet görs efter den 31 december.</p>
        )}
        {done && <Note tone="good">{done}</Note>}
      </section>
      <ErrorLine text={error} />
    </div>
  );
}
