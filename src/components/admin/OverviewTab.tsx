"use client";

import { categories } from "@/content/categories";
import { formatSlot } from "@/lib/time";
import type { AdminData } from "./api";
import { townOf } from "./api";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-night tabular-nums">{value}</p>
    </div>
  );
}

export function OverviewTab({ data }: { data: AdminData }) {
  const { leads } = data;
  const now = data.now;
  const weekAgo = now - 7 * 86400_000;
  const hosts = leads.filter((l) => l.kind === "host").length;
  const upcoming = data.slots.filter((s) => s.booking && Date.parse(s.start) > now).sort((a, b) => a.start.localeCompare(b.start));

  const byCity = new Map<string, { hosts: number; renters: number; week: number }>();
  for (const l of leads) {
    const town = townOf(l);
    const row = byCity.get(town) ?? { hosts: 0, renters: 0, week: 0 };
    if (l.kind === "host") row.hosts++;
    else row.renters++;
    if (Date.parse(l.createdAt) > weekAgo) row.week++;
    byCity.set(town, row);
  }
  const cityRows = [...byCity.entries()].sort((a, b) => b[1].hosts + b[1].renters - (a[1].hosts + a[1].renters));

  const items = categories
    .map((c) => ({
      name: c.name.sv,
      renters: leads.filter((l) => l.kind === "renter" && (l.data.items ?? "").split(",").map((s) => s.trim()).includes(c.id)).length,
      hosts: leads.filter((l) => l.kind === "host" && (l.data.accepts ?? "").split(",").map((s) => s.trim()).includes(c.id)).length,
    }))
    .sort((a, b) => b.renters - a.renters);

  const sources = new Map<string, number>();
  for (const l of leads) {
    const s = l.data.utm_source || "Direkt";
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Anmälningar" value={leads.length} />
        <Stat label="Värdar" value={hosts} />
        <Stat label="Hyresgäster" value={leads.length - hosts} />
        <Stat label="Senaste 7 dagarna" value={leads.filter((l) => Date.parse(l.createdAt) > weekAgo).length} />
        <Stat label="Bokade besök" value={upcoming.length} />
      </div>

      {leads.length === 0 && (
        <p className="card p-5 leading-relaxed text-muted">
          Inga anmälningar här än. Nya anmälningar från formulären dyker upp här automatiskt. Anmälningar från före admin byggdes finns kvar i Netlify under Forms.
        </p>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-2xl text-night">Kommande besök</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper">
            {upcoming.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-night first-letter:uppercase">{formatSlot(s.start, "sv")}</span>
                <span className="text-muted">
                  {s.booking?.name}, {s.booking?.address}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-2xl text-night">Per stad</h2>
        <p className="mt-1 text-muted">Här ser du var flest väntar, och därmed vilken stad som borde öppna härnäst.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[28rem] text-left text-[0.95rem]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-2.5 font-semibold">Stad</th>
                <th className="px-4 py-2.5 text-right font-semibold">Värdar</th>
                <th className="px-4 py-2.5 text-right font-semibold">Hyresgäster</th>
                <th className="px-4 py-2.5 text-right font-semibold">Totalt</th>
                <th className="px-4 py-2.5 text-right font-semibold">7 dagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {cityRows.map(([town, r]) => (
                <tr key={town}>
                  <th scope="row" className="px-4 py-2.5 font-semibold text-night">
                    {town}
                  </th>
                  <td className="px-4 py-2.5 text-right">{r.hosts}</td>
                  <td className="px-4 py-2.5 text-right">{r.renters}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-night">{r.hosts + r.renters}</td>
                  <td className="px-4 py-2.5 text-right">{r.week}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl text-night">Förvaring</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="w-full text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-4 py-2.5 font-semibold">Typ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Söker</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Erbjuder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {items.map((i) => (
                  <tr key={i.name}>
                    <th scope="row" className="px-4 py-2.5 font-semibold text-night">
                      {i.name}
                    </th>
                    <td className="px-4 py-2.5 text-right">{i.renters}</td>
                    <td className="px-4 py-2.5 text-right">{i.hosts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="text-2xl text-night">Källor</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper text-[0.95rem]">
            {[...sources.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <li key={s} className="flex justify-between px-4 py-2.5">
                  <span className="font-semibold text-night">{s}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
