"use client";

import { useState, type FormEvent } from "react";
import type { Account } from "@/lib/app/bookkeeping";
import { acc, DataTable, ErrorLine, errorText } from "./shared";

export function Accounts({ accounts, onChanged }: { accounts: Account[]; onChanged: () => Promise<void> | void }) {
  const [form, setForm] = useState({ number: "", name: "", vat_box: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(a: { number: number; name: string; vat_box: string | null; active: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await acc("acc_save_account", { p_number: a.number, p_name: a.name, p_vat_box: a.vat_box ?? "", p_active: a.active });
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const n = Number(form.number);
    if (!Number.isInteger(n) || n < 1000 || n > 9999) return setError("Kontonumret ska ha fyra siffror (BAS).");
    if (!form.name.trim()) return setError("Skriv kontots namn.");
    if (form.vat_box && !/^\d{2}$/.test(form.vat_box)) return setError("Momsrutan är två siffror, till exempel 05.");
    void save({ number: n, name: form.name.trim(), vat_box: form.vat_box || null, active: true }).then(() => setForm({ number: "", name: "", vat_box: "" }));
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.95rem] text-muted">Kontoplanen följer BAS. Lägg till de konton du behöver; ett konto som används kan byta namn eller stängas av, men inte tas bort.</p>
      <form onSubmit={add} className="card grid gap-3 p-4 sm:grid-cols-[7rem_1fr_6rem_auto] sm:items-end">
        <div>
          <label htmlFor="a-number" className="field-label">
            Konto
          </label>
          <input id="a-number" className="field-input" inputMode="numeric" maxLength={4} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </div>
        <div>
          <label htmlFor="a-name" className="field-label">
            Namn
          </label>
          <input id="a-name" className="field-input" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="a-box" className="field-label">
            Momsruta
          </label>
          <input id="a-box" className="field-input" inputMode="numeric" maxLength={2} placeholder="05" value={form.vat_box} onChange={(e) => setForm({ ...form, vat_box: e.target.value })} />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          Lägg till
        </button>
      </form>
      <ErrorLine text={error} />
      <DataTable
        head={["Konto", "Namn", "Momsruta", ""]}
        rows={accounts.map((a) => [
          <span key="n" className={a.active ? "font-bold" : "text-muted"}>
            {a.number}
          </span>,
          <span key="t" className={a.active ? "" : "text-muted line-through"}>
            {a.name}
          </span>,
          a.vat_box ?? "",
          <span key="x" className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              onClick={() => {
                const name = window.prompt(`Nytt namn för ${a.number}:`, a.name);
                if (name && name.trim() && name.trim() !== a.name) void save({ ...a, name: name.trim() });
              }}
            >
              Byt namn
            </button>
            <button type="button" disabled={busy} className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => save({ ...a, active: !a.active })}>
              {a.active ? "Stäng av" : "Slå på"}
            </button>
          </span>,
        ])}
      />
    </div>
  );
}
