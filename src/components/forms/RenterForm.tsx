"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Dictionary } from "@/content";
import { categories, type CategoryId } from "@/content/categories";
import { tidyTown } from "@/content/cities";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath, RENTER_PARAMS } from "@/lib/routes";
import { site } from "@/lib/site";
import { categoryIcons } from "../Icons";
import { ChoiceGroup, ConsentField, Honeypot, SelectField, TextArea, TextField, TownField, type Errors } from "./FormFields";
import { EMAIL_RE, list, orNull, str, townFromQuery, useLeadForm, useQueryString } from "./useLeadForm";

const categoryIds = categories.map((c) => c.id) as string[];

function parsePrefill(params: URLSearchParams): { items: string[]; town: string } {
  const item = params.get(RENTER_PARAMS.item);
  return {
    items: item && categoryIds.includes(item) ? [item] : [],
    town: townFromQuery(params),
  };
}

export function RenterForm({ lang, t }: { lang: Lang; t: Dictionary }) {
  const f = t.forms;
  const r = f.renter;
  // Pre-fill from ?vad=tyres&ort=Göteborg (links from the hero search and the
  // category and city pages) until the visitor changes the field themselves.
  const prefill = parsePrefill(useQueryString());
  const [chosenItems, setChosenItems] = useState<string[] | null>(null);
  const [chosenTown, setChosenTown] = useState<string | null>(null);
  const items = chosenItems ?? prefill.items;
  const town = chosenTown ?? prefill.town;

  const toggle = (value: string) =>
    setChosenItems(items.includes(value) ? items.filter((v) => v !== value) : [...items, value]);

  const validate = (data: FormData): Errors => ({
    first_name: str(data, "first_name") ? undefined : f.required,
    email: !str(data, "email") ? f.required : EMAIL_RE.test(str(data, "email")) ? undefined : f.invalidEmail,
    items: list(data, "items").length ? undefined : f.pickOne,
    city: str(data, "city") ? undefined : f.required,
    start: str(data, "start") ? undefined : f.required,
    duration: str(data, "duration") ? undefined : f.required,
    consent: data.get("consent") === "yes" ? undefined : f.consentRequired,
  });

  const toPayload = (data: FormData) => ({
    first_name: str(data, "first_name"),
    email: str(data, "email").toLowerCase(),
    phone: orNull(str(data, "phone")),
    items: list(data, "items") as CategoryId[],
    quantity: orNull(str(data, "quantity")),
    city: tidyTown(str(data, "city")),
    start: str(data, "start"),
    duration: str(data, "duration"),
    heated: orNull(str(data, "heated")),
    occupation: orNull(str(data, "occupation")),
    has_bankid: orNull(str(data, "has_bankid")),
    engine_heater: items.includes("parking") ? orNull(str(data, "engine_heater")) : null,
    message: orNull(str(data, "message")),
    consent: true,
  });

  const { status, errors, onSubmit, successRef } = useLeadForm("renter", lang, validate, toPayload);

  if (status === "success") {
    return (
      <div ref={successRef} tabIndex={-1} className="card p-6 text-center outline-none sm:p-10" role="status">
        <CheckCircle2 size={48} className="mx-auto text-pine" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-bold text-night">{r.successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{r.successText}</p>
        <Link prefetch={false} href={pagePath("trust", lang)} className="btn btn-secondary mt-6">
          {t.trust.link}
        </Link>
      </div>
    );
  }

  const options = (record: Record<string, string>) =>
    Object.entries(record).map(([value, label]) => ({ value, label }));

  return (
    <form
      name="renter-lead"
      noValidate
      onSubmit={onSubmit}
      className="card space-y-6 p-5 sm:p-8"
      aria-busy={status === "sending"}
    >
      <Honeypot />

      <ChoiceGroup
        name="items"
        label={r.items}
        multiple
        selected={items}
        onToggle={toggle}
        options={categories.map((c) => {
          const Icon = categoryIcons[c.id];
          return { value: c.id, label: c.name[lang], icon: <Icon size={18} /> };
        })}
        error={errors.items}
      />

      <TextField
        name="quantity"
        label={r.quantity}
        placeholder={r.quantityPlaceholder}
        optionalLabel={f.optional}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <TownField label={f.town} placeholder={f.townPlaceholder} value={town} onChange={setChosenTown} error={errors.city} />
        <SelectField
          name="start"
          label={r.start}
          placeholder="–"
          options={options(r.starts)}
          required
          error={errors.start}
        />
        <SelectField
          name="duration"
          label={r.duration}
          placeholder="–"
          options={options(r.durations)}
          required
          error={errors.duration}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {items.includes("parking") && (
          <ChoiceGroup
            name="engine_heater"
            label={r.engineHeater}
            options={options(r.engineHeaterOptions)}
            optionalLabel={f.optional}
          />
        )}
        <ChoiceGroup name="heated" label={r.heated} options={options(r.heatedOptions)} optionalLabel={f.optional} />
        <ChoiceGroup name="occupation" label={r.occupation} options={options(r.occupations)} optionalLabel={f.optional} />
      </div>

      <ChoiceGroup name="has_bankid" label={r.bankid} options={options(r.bankidOptions)} optionalLabel={f.optional} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="first_name" label={f.firstName} required autoComplete="given-name" error={errors.first_name} />
        <TextField
          name="email"
          label={f.email}
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          error={errors.email}
        />
        <TextField
          name="phone"
          label={f.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          optionalLabel={f.optional}
        />
      </div>

      <TextArea name="message" label={f.message} placeholder={r.messagePlaceholder} optionalLabel={f.optional} />

      <ConsentField error={errors.consent}>
        {f.consentBefore}
        <Link prefetch={false} href={pagePath("privacy", lang)} className="font-medium underline underline-offset-4" target="_blank">
          {f.consentLink}
        </Link>
        {f.consentAfter}
      </ConsentField>

      {status === "error" && (
        <p role="alert" className="rounded-xl bg-[#fef3f2] p-4 text-[0.95rem] font-medium text-[#b42318]">
          {fill(f.errorGeneric, { email: site.email })}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={status === "sending"}>
        {status === "sending" ? f.sending : r.submit}
      </button>
    </form>
  );
}
