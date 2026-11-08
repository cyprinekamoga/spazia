"use client";

import { CreditCard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { appText } from "@/content/app";
import { fill } from "@/lib/i18n";
import { cardBrand, goToStripe, paymentsCall, type PaymentSetup } from "@/lib/app/payments";

const t = appText.payments;

/**
 * The renter's saved card, with a button to add or change it in Stripe
 * Checkout. Coming back from Checkout (?kort=<session>) saves the card.
 */
export function CardSection({
  setup,
  onChange,
  returnTo,
  intro = t.cardText,
  compact = false,
}: {
  setup: PaymentSetup;
  onChange: () => void | Promise<void>;
  /** App path to come back to, e.g. "/kund/skicka?id=…". */
  returnTo: string;
  intro?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const handled = useRef(false);

  // Back from Stripe Checkout: save the card, then drop the parameter from the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("kort");
    if (!session || handled.current) return;
    handled.current = true;
    setSaving(true);
    paymentsCall("card_done", { session })
      .catch(() => setError(true))
      .finally(async () => {
        params.delete("kort");
        const qs = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        await onChange();
        setSaving(false);
      });
  }, [onChange]);

  async function addCard() {
    setBusy(true);
    setError(false);
    try {
      await goToStripe("card", { returnTo });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const card = setup.card;
  return (
    <section className={compact ? "rounded-2xl border border-line p-4" : "card p-5"}>
      <h2 className={`flex items-center gap-2 font-bold text-night ${compact ? "text-lg" : "text-xl"}`}>
        <CreditCard size={20} className="text-brand" aria-hidden="true" />
        {t.cardTitle}
      </h2>
      <p className="mt-1 leading-relaxed text-muted">{intro}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-night" aria-live="polite">
          {saving ? t.cardSaving : card ? fill(t.cardShown, { brand: cardBrand(card.brand), last4: card.last4 ?? "" }) + (card.exp ? ` (${card.exp})` : "") : t.cardNone}
        </p>
        <button type="button" disabled={busy || saving} onClick={addCard} className={`btn ${card ? "btn-secondary" : "btn-primary"} !min-h-11`}>
          {busy ? t.redirecting : card ? t.cardChange : t.cardAdd}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[#fef3f2] p-3 text-[0.95rem] font-medium text-[#b42318]">
          {appText.common.error}
        </p>
      )}
    </section>
  );
}
