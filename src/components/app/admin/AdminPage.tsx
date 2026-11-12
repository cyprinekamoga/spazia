"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatKr, formatMoment } from "@/lib/app/model";
import { useLoad } from "@/lib/app/session";
import { supabase } from "@/lib/supabase";
import { Spinner } from "../AppShell";

/**
 * The team's admin page in the app (internal, Swedish only). Only accounts in
 * private.admins get data: every function checks that in the database.
 */

type Row = Record<string, unknown>;
type Tab = "overview" | "reports" | "bookings" | "payments" | "listings" | "users" | "log";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Översikt" },
  { id: "reports", label: "Anmälningar" },
  { id: "bookings", label: "Bokningar" },
  { id: "payments", label: "Betalningar" },
  { id: "listings", label: "Annonser" },
  { id: "users", label: "Användare" },
  { id: "log", label: "Logg" },
];

const REASONS: Record<string, string> = {
  fraud: "Bedrägeri",
  wrong_info: "Stämmer inte",
  unsafe: "Otryggt",
  harassment: "Trakasserier",
  illegal: "Olagligt",
  other: "Annat",
};

const s = (v: unknown) => (v == null ? "" : String(v));
const when = (v: unknown) => (v ? formatMoment(String(v)) : "–");
const day = (v: unknown) => (v ? String(v).slice(0, 10) : "–");

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await supabase().rpc(name, args);
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const cls = { neutral: "bg-frost text-night", good: "bg-[#e7f4ec] text-[#1f6b3a]", warn: "bg-[#fff4e0] text-[#8a5a00]", bad: "bg-[#fef3f2] text-[#b42318]" }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function statusTone(status: string): "neutral" | "good" | "warn" | "bad" {
  if (["paid", "accepted", "published", "resolved"].includes(status)) return "good";
  if (["due", "processing", "pending", "open", "paused", "draft"].includes(status)) return "warn";
  if (["failed", "cancelled", "declined", "expired", "refunded"].includes(status)) return "bad";
  return "neutral";
}

/** Ask for a short note, then run the action. */
function useAction(onDone: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, question: string, fn: (note: string) => Promise<unknown>) {
    const note = window.prompt(question, "");
    if (note === null) return;
    setBusy(key);
    setError(null);
    try {
      await fn(note);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    }
    setBusy(null);
  }
  return { busy, error, run };
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onSearch(q.trim());
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className="field-input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={placeholder} />
      <button type="submit" className="btn btn-secondary" aria-label="Sök">
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

function Overview() {
  const { data, loading, reload } = useLoad(() => rpc<Row>("admin_overview"), "admin-overview");
  if (loading) return <Spinner />;
  if (!data) return null;
  const cards: [string, string][] = [
    ["Användare", `${s(data.users)} (+${s(data.users_week)} senaste veckan)`],
    ["Publicerade annonser", s(data.listings_published)],
    ["Obesvarade förfrågningar", s(data.requests_pending)],
    ["Pågående uthyrningar", s(data.rentals_active)],
    ["Betalt denna månad", `${formatKr(Number(data.paid_month))} kr`],
    ["Spazias avgifter denna månad", `${formatKr(Number(data.fees_month))} kr`],
    ["Misslyckade betalningar", s(data.payments_failed)],
    ["Öppna anmälningar", s(data.reports_open)],
  ];
  const mode = s(data.payments_mode);
  return (
    <div className="space-y-4">
      <p className="text-[0.95rem] text-ink">
        Betalningar: <Pill tone={mode === "true" ? "good" : mode === "test" ? "warn" : "neutral"}>{mode === "true" ? "på för alla" : mode === "test" ? "testläge" : "av"}</Pill>
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {cards.map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-sm font-semibold text-muted">{k}</dt>
            <dd className="mt-1 text-xl font-bold text-night">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={reload} className="btn btn-secondary">
        <RefreshCw size={16} aria-hidden="true" />
        Uppdatera
      </button>
    </div>
  );
}

function Reports() {
  const [openOnly, setOpenOnly] = useState(true);
  const { data, loading, reload } = useLoad(() => rpc<Row[]>("admin_reports", { p_open_only: openOnly }), `admin-reports-${openOnly}`);
  const act = useAction(reload);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[0.95rem]">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4" />
        Bara öppna
      </label>
      {act.error && <p className="text-sm font-medium text-[#b42318]">{act.error}</p>}
      {loading ? (
        <Spinner />
      ) : (data ?? []).length === 0 ? (
        <p className="text-muted">Inga anmälningar.</p>
      ) : (
        (data ?? []).map((r) => {
          const id = s(r.id);
          const kind = s(r.target_kind);
          return (
            <article key={id} className="card p-4 text-[0.95rem]">
              <p className="flex flex-wrap items-center gap-2">
                <Pill tone={statusTone(s(r.status))}>{s(r.status)}</Pill>
                <span className="font-bold text-night">{REASONS[s(r.reason)] ?? s(r.reason)}</span>
                <span className="text-muted">
                  {kind === "listing" ? "Annons" : kind === "user" ? "Användare" : "Meddelande"} · {when(r.created_at)}
                </span>
              </p>
              <p className="mt-1 text-night">{s(r.target_text)}</p>
              <p className="text-sm text-muted">Ägare: {s(r.target_owner_email) || "–"}</p>
              {s(r.details) && <p className="mt-2 whitespace-pre-wrap text-ink">”{s(r.details)}”</p>}
              <p className="mt-1 text-sm text-muted">Anmäld av {s(r.reporter_name) || "–"} ({s(r.reporter_email)})</p>
              {s(r.resolution) && <p className="mt-1 text-sm text-ink">Åtgärd: {s(r.resolution)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {s(r.status) === "open" ? (
                  <>
                    <button type="button" disabled={!!act.busy} className="btn btn-secondary" onClick={() => act.run(id, "Vad gjorde du? (sparas)", (n) => rpc("admin_resolve_report", { p_report: id, p_status: "resolved", p_note: n }))}>
                      Åtgärdad
                    </button>
                    <button type="button" disabled={!!act.busy} className="btn btn-secondary" onClick={() => act.run(id, "Varför avfärdas den? (sparas)", (n) => rpc("admin_resolve_report", { p_report: id, p_status: "dismissed", p_note: n }))}>
                      Avfärda
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={!!act.busy} className="btn btn-secondary" onClick={() => act.run(id, "Varför öppnas den igen?", (n) => rpc("admin_resolve_report", { p_report: id, p_status: "open", p_note: n }))}>
                    Öppna igen
                  </button>
                )}
                {kind === "listing" && (
                  <button type="button" disabled={!!act.busy} className="btn text-[#b42318] hover:bg-[#fef3f2]" onClick={() => act.run(`p-${id}`, "Pausa annonsen? Skriv varför (sparas).", (n) => rpc("admin_set_listing_status", { p_listing: s(r.target_id), p_status: "paused", p_note: n }))}>
                    Pausa annonsen
                  </button>
                )}
                {s(r.target_owner_id) && (
                  <button type="button" disabled={!!act.busy} className="btn text-[#b42318] hover:bg-[#fef3f2]" onClick={() => act.run(`b-${id}`, "Blockera kontot? Personen kan inte logga in och annonserna pausas. Skriv varför (sparas).", (n) => rpc("admin_set_blocked", { p_user: s(r.target_owner_id), p_blocked: true, p_note: n }))}>
                    Blockera kontot
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-frost/60 text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-night">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bookings() {
  const [q, setQ] = useState("");
  const { data, loading } = useLoad(() => rpc<Row[]>("admin_bookings", { p_search: q, p_limit: 200 }), `admin-bookings-${q}`);
  return (
    <div className="space-y-3">
      <SearchBox onSearch={setQ} placeholder="Sök annons, ort eller e-post" />
      {loading ? (
        <Spinner />
      ) : (
        <Table
          head={["Skapad", "Annons", "Typ", "Status", "Period", "Värd", "Hyresgäst", "Betalt", "Avtal"]}
          rows={(data ?? []).map((r) => [
            when(r.created_at),
            `${s(r.title)} (${s(r.city)})`,
            s(r.kind) === "hour" ? "Timme" : "Månad",
            <Pill key="s" tone={statusTone(s(r.status))}>{s(r.status)}</Pill>,
            s(r.kind) === "hour" ? `${when(r.start_at)} – ${when(r.end_at)}` : `${day(r.start_date)} – ${r.end_date ? day(r.end_date) : "tills vidare"}`,
            `${s(r.host_name)} ${s(r.host_email)}`,
            `${s(r.renter_name)} ${s(r.renter_email)}`,
            r.payment_required ? `${formatKr(Number(r.paid_total))} kr` : "utan betalning",
            r.renter_agreed_at && r.host_agreed_at ? "båda" : r.renter_agreed_at ? "hyresgäst" : r.host_agreed_at ? "värd" : "–",
          ])}
        />
      )}
    </div>
  );
}

function Payments() {
  const [q, setQ] = useState("");
  const { data, loading, reload } = useLoad(() => rpc<Row[]>("admin_payments", { p_search: q, p_limit: 200 }), `admin-payments-${q}`);
  const act = useAction(reload);
  return (
    <div className="space-y-3">
      <SearchBox onSearch={setQ} placeholder="Sök annons, e-post eller status" />
      {act.error && <p className="text-sm font-medium text-[#b42318]">{act.error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          head={["Skapad", "Annons", "Status", "Period", "Belopp", "Värden får", "Överfört", "Hyresgäst", "Stripe", ""]}
          rows={(data ?? []).map((p) => {
            const id = s(p.id);
            const refundable = s(p.status) === "paid" && !p.refund_requested_at;
            return [
              when(p.created_at),
              s(p.title),
              <span key="s">
                <Pill tone={statusTone(s(p.status))}>{s(p.status)}</Pill>
                {p.disputed_at ? (
                  <>
                    {" "}
                    <Pill tone="bad">tvist</Pill>
                  </>
                ) : null}
                {s(p.failure) && <span className="block text-xs text-[#b42318]">{s(p.failure)}</span>}
              </span>,
              `${day(p.period_start)} – ${day(p.period_end)}`,
              `${formatKr(Number(p.amount))} kr`,
              `${formatKr(Number(p.host_amount))} kr`,
              p.transferred_at ? when(p.transferred_at) : `planerat ${when(p.transfer_due_at)}`,
              s(p.renter_email),
              <span key="ids" className="block max-w-[12rem] break-all text-xs text-muted">
                {s(p.stripe_invoice || p.stripe_payment_intent)}
              </span>,
              refundable ? (
                <button
                  key="r"
                  type="button"
                  disabled={!!act.busy}
                  className="btn text-[#b42318] hover:bg-[#fef3f2]"
                  onClick={() => act.run(id, `Återbetala hela beloppet, ${formatKr(Number(p.amount))} kr? Värdens del dras tillbaka om den redan är överförd. Skriv varför (sparas).`, (n) => rpc("admin_refund_payment", { p_payment: id, p_note: n }))}
                >
                  {act.busy === id ? <Loader2 size={16} className="animate-spin" /> : "Återbetala"}
                </button>
              ) : p.refund_requested_at ? (
                <span key="r" className="text-xs text-muted">
                  återbetalning {p.refunded_at ? "klar" : "på väg"}
                </span>
              ) : (
                ""
              ),
            ];
          })}
        />
      )}
    </div>
  );
}

function Listings() {
  const [q, setQ] = useState("");
  const { data, loading, reload } = useLoad(() => rpc<Row[]>("admin_listings", { p_search: q, p_limit: 200 }), `admin-listings-${q}`);
  const act = useAction(reload);
  return (
    <div className="space-y-3">
      <SearchBox onSearch={setQ} placeholder="Sök titel, ort eller e-post" />
      {act.error && <p className="text-sm font-medium text-[#b42318]">{act.error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          head={["Ändrad", "Annons", "Status", "Värd", "Uthyrningar", "Anmälningar", ""]}
          rows={(data ?? []).map((l) => {
            const id = s(l.id);
            const published = s(l.status) === "published";
            return [
              when(l.updated_at),
              <Link key="t" prefetch={false} href={`/annons?id=${id}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                {s(l.title) || "(utan titel)"} ({s(l.city)})
              </Link>,
              <Pill key="s" tone={statusTone(s(l.status))}>{s(l.status)}</Pill>,
              `${s(l.host_name)} ${s(l.host_email)}`,
              s(l.accepted_requests),
              Number(l.open_reports) > 0 ? <Pill key="r" tone="bad">{s(l.open_reports)}</Pill> : "0",
              s(l.status) === "draft" ? (
                ""
              ) : (
                <button
                  key="a"
                  type="button"
                  disabled={!!act.busy}
                  className="btn btn-secondary"
                  onClick={() => act.run(id, published ? "Pausa annonsen? Skriv varför (sparas)." : "Publicera annonsen igen? Skriv varför (sparas).", (n) => rpc("admin_set_listing_status", { p_listing: id, p_status: published ? "paused" : "published", p_note: n }))}
                >
                  {published ? "Pausa" : "Publicera"}
                </button>
              ),
            ];
          })}
        />
      )}
    </div>
  );
}

function Users() {
  const [q, setQ] = useState("");
  const { data, loading, reload } = useLoad(() => rpc<Row[]>("admin_users", { p_search: q, p_limit: 200 }), `admin-users-${q}`);
  const act = useAction(reload);
  return (
    <div className="space-y-3">
      <SearchBox onSearch={setQ} placeholder="Sök e-post eller namn" />
      {act.error && <p className="text-sm font-medium text-[#b42318]">{act.error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          head={["Skapad", "Namn", "E-post", "Senast inloggad", "Annonser", "Förfrågningar", "Utbetalningar", "Anmälningar", ""]}
          rows={(data ?? []).map((u) => {
            const id = s(u.id);
            return [
              when(u.created_at),
              <span key="n">
                {s(u.first_name) || "–"} {u.admin ? <Pill>admin</Pill> : null} {u.blocked ? <Pill tone="bad">blockerad</Pill> : null}
              </span>,
              s(u.email),
              when(u.last_sign_in_at),
              s(u.listings),
              s(u.requests),
              u.payouts_ready ? "klara" : u.payouts_ready === false ? "ej klara" : "–",
              Number(u.open_reports) > 0 ? <Pill key="r" tone="bad">{s(u.open_reports)}</Pill> : "0",
              u.admin ? (
                ""
              ) : (
                <button
                  key="b"
                  type="button"
                  disabled={!!act.busy}
                  className={u.blocked ? "btn btn-secondary" : "btn text-[#b42318] hover:bg-[#fef3f2]"}
                  onClick={() =>
                    act.run(id, u.blocked ? "Häva blockeringen? Skriv varför (sparas)." : "Blockera kontot? Personen kan inte logga in och annonserna pausas. Skriv varför (sparas).", (n) =>
                      rpc("admin_set_blocked", { p_user: id, p_blocked: !u.blocked, p_note: n }),
                    )
                  }
                >
                  {u.blocked ? "Häv blockering" : "Blockera"}
                </button>
              ),
            ];
          })}
        />
      )}
    </div>
  );
}

function Log() {
  const { data, loading } = useLoad(() => rpc<Row[]>("admin_log_entries", { p_limit: 200 }), "admin-log");
  if (loading) return <Spinner />;
  return (
    <Table
      head={["När", "Vem", "Åtgärd", "Gäller", "Anteckning"]}
      rows={(data ?? []).map((g) => [when(g.created_at), s(g.admin_email), s(g.action), <span key="t" className="break-all text-xs">{s(g.target)}</span>, s(g.note)])}
    />
  );
}

export function AdminPage() {
  const access = useLoad(() => rpc<boolean>("am_i_admin").catch(() => false), "am-i-admin");
  const [tab, setTab] = useState<Tab>("overview");

  if (access.loading) return <Spinner />;
  if (!access.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <p className="text-lg text-muted">Den här sidan är bara för Spazias team.</p>
        <Link prefetch={false} href="/" className="btn btn-secondary mt-4">
          Till appen
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6">
      <Link prefetch={false} href="/vard/meny" className="flex min-h-11 w-fit items-center gap-1.5 font-semibold text-night">
        <ArrowLeft size={18} aria-hidden="true" />
        Till appen
      </Link>
      <h1 className="mt-2 text-[2rem] leading-tight text-night">Admin</h1>
      <nav aria-label="Admin" className="mt-4 -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className="flex min-h-11 items-center rounded-full px-3.5 text-[0.95rem] font-semibold whitespace-nowrap text-muted hover:bg-frost hover:text-night aria-[current=page]:bg-frost aria-[current=page]:text-night"
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "reports" && <Reports />}
        {tab === "bookings" && <Bookings />}
        {tab === "payments" && <Payments />}
        {tab === "listings" && <Listings />}
        {tab === "users" && <Users />}
        {tab === "log" && <Log />}
      </div>
    </div>
  );
}
