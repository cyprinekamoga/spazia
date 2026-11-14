"use client";

import { Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { balanceSheet, incomeStatement, kr, type Balance, type GroupTotal } from "@/lib/app/bookkeeping";
import { useLoad } from "@/lib/app/session";
import { Spinner } from "../../AppShell";
import { acc, DataTable, Money } from "./shared";

type Report = "result" | "balance" | "ledger" | "journal";

interface LedgerData {
  account: number;
  name: string;
  opening: number;
  lines: { voucher_id: string; label: string; date: string; description: string; amount: number; note: string }[];
}

interface JournalVoucher {
  id: string;
  label: string;
  date: string;
  description: string;
  lines: { account: number; name: string; amount: number; vat_box: string | null; note: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function periodOptions(year: number) {
  const opts: { id: string; label: string; from: string; to: string }[] = [{ id: "year", label: `Hela ${year}`, from: `${year}-01-01`, to: `${year}-12-31` }];
  for (let q = 1; q <= 4; q++) {
    const m1 = (q - 1) * 3 + 1;
    opts.push({ id: `q${q}`, label: `Kvartal ${q}`, from: `${year}-${pad(m1)}-01`, to: `${year}-${pad(m1 + 2)}-${lastDay(year, m1 + 2)}` });
  }
  const months = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  months.forEach((name, i) => opts.push({ id: `m${i + 1}`, label: name[0].toUpperCase() + name.slice(1), from: `${year}-${pad(i + 1)}-01`, to: `${year}-${pad(i + 1)}-${lastDay(year, i + 1)}` }));
  return opts;
}

function Groups({ groups, totalLabel, total }: { groups: GroupTotal[]; totalLabel: string; total: number }) {
  return (
    <DataTable
      head={["", "Belopp"]}
      align={["left", "right"]}
      rows={groups.flatMap((g) => [
        [<span key="g" className="font-bold">{g.label}</span>, <Money key="t" value={g.total} strong />],
        ...g.accounts.map((a) => [<span key="a" className="pl-4 text-ink">{a.number ? `${a.number} ${a.name}` : a.name}</span>, <Money key="m" value={a.amount} />]),
      ])}
      foot={[totalLabel, kr(total)]}
    />
  );
}

export function Reports({ year, closed }: { year: number; closed: boolean }) {
  const [report, setReport] = useState<Report>("result");
  const options = periodOptions(year);
  const [periodId, setPeriodId] = useState("year");
  const period = options.find((p) => p.id === periodId) ?? options[0];
  const [account, setAccount] = useState<number | null>(null);
  const yearStart = `${year}-01-01`;

  const balances = useLoad(
    () => acc<Balance[]>("acc_balances", { p_from: report === "balance" ? yearStart : period.from, p_to: period.to }),
    `acc-bal-${report === "balance" ? "b" : "r"}-${period.from}-${period.to}`,
  );
  const ledger = useLoad(
    () => (report === "ledger" && account ? acc<LedgerData>("acc_ledger", { p_account: account, p_from: period.from, p_to: period.to }) : Promise.resolve(null)),
    `acc-ledger-${report}-${account}-${period.from}-${period.to}`,
  );
  const journal = useLoad(
    () => (report === "journal" ? acc<JournalVoucher[]>("acc_journal", { p_from: period.from, p_to: period.to }) : Promise.resolve(null)),
    `acc-journal-${report}-${period.from}-${period.to}`,
  );

  const tabs: [Report, string][] = [
    ["result", "Resultaträkning"],
    ["balance", "Balansräkning"],
    ["ledger", "Huvudbok"],
    ["journal", "Grundbok"],
  ];

  let body = null;
  if (balances.loading || (report === "ledger" && ledger.loading) || (report === "journal" && journal.loading)) {
    body = <Spinner />;
  } else if (report === "result") {
    const s = incomeStatement(balances.data ?? []);
    body = s.groups.length ? <Groups groups={s.groups} totalLabel="Resultat" total={s.result} /> : <p className="text-muted">Inget bokfört i perioden.</p>;
  } else if (report === "balance") {
    const all = balances.data ?? [];
    const result = closed ? 0 : incomeStatement(all).result;
    const s = balanceSheet(all, result);
    body = (
      <div className="space-y-4">
        <h4 className="font-bold text-night">Tillgångar per {period.to}</h4>
        <Groups groups={s.assets} totalLabel="Summa tillgångar" total={s.totalAssets} />
        <h4 className="font-bold text-night">Eget kapital och skulder</h4>
        <Groups groups={s.equity} totalLabel="Summa eget kapital och skulder" total={s.totalEquity} />
        {Math.abs(s.totalAssets - s.totalEquity) > 0.004 && <p className="text-sm font-semibold text-[#b42318]">Skillnad {kr(s.totalAssets - s.totalEquity)} kr: kontrollera ingående balanser.</p>}
      </div>
    );
  } else if (report === "ledger") {
    const list = balances.data ?? [];
    body = (
      <div className="space-y-4">
        <DataTable
          head={["Konto", "Ingående", "Debet", "Kredit", "Utgående"]}
          align={["left", "right", "right", "right", "right"]}
          rows={list.map((b) => [
            <button key="a" type="button" className="text-left font-semibold text-brand underline-offset-4 hover:underline" onClick={() => setAccount(b.number)}>
              {b.number} {b.name}
            </button>,
            <Money key="o" value={b.opening} />,
            <Money key="d" value={b.debit} />,
            <Money key="c" value={b.credit} />,
            <Money key="u" value={b.closing} />,
          ])}
        />
        {ledger.data && (
          <>
            <h4 className="font-bold text-night">
              {ledger.data.account} {ledger.data.name}
            </h4>
            <DataTable
              head={["Datum", "Ver", "Text", "Debet", "Kredit", "Saldo"]}
              align={["left", "left", "left", "right", "right", "right"]}
              rows={[
                ["", "", "Ingående saldo", "", "", <Money key="o" value={ledger.data.opening} />],
                ...ledger.data.lines.reduce<{ rows: ReactNode[][]; bal: number }>(
                  (acc2, l) => {
                    const bal = acc2.bal + l.amount;
                    acc2.rows.push([l.date, l.label, l.note ? `${l.description} (${l.note})` : l.description, l.amount > 0 ? <Money key="d" value={l.amount} /> : "", l.amount < 0 ? <Money key="c" value={-l.amount} /> : "", <Money key="b" value={bal} />]);
                    return { rows: acc2.rows, bal };
                  },
                  { rows: [], bal: ledger.data.opening },
                ).rows,
              ]}
            />
          </>
        )}
      </div>
    );
  } else {
    const list = journal.data ?? [];
    body = list.length ? (
      <div className="space-y-3">
        {list.map((v) => (
          <div key={v.id} className="card p-3">
            <p className="font-bold text-night">
              {v.label} · {v.date} · <span className="font-normal">{v.description}</span>
            </p>
            <table className="mt-1 w-full text-sm">
              <tbody>
                {v.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-0.5 text-ink">
                      {l.account} {l.name}
                    </td>
                    <td className="w-28 py-0.5 text-right">{l.amount > 0 ? <Money value={l.amount} /> : ""}</td>
                    <td className="w-28 py-0.5 text-right">{l.amount < 0 ? <Money value={-l.amount} /> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-muted">Inget bokfört i perioden.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-wrap gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setReport(id)} aria-pressed={report === id} className="min-h-11 rounded-full px-3.5 text-[0.95rem] font-semibold text-muted hover:bg-frost aria-pressed:bg-frost aria-pressed:text-night">
              {label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="r-period" className="field-label">
            Period
          </label>
          <select id="r-period" className="field-input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => window.print()} className="btn btn-secondary">
          <Printer size={18} aria-hidden="true" />
          Skriv ut / spara PDF
        </button>
      </div>
      <h3 className="text-xl font-bold text-night">
        {tabs.find(([id]) => id === report)?.[1]} · {report === "balance" ? `per ${period.to}` : `${period.from} – ${period.to}`}
      </h3>
      {body}
    </div>
  );
}
