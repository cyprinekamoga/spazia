"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Dictionary } from "@/content";
import { areas } from "@/content/areas";
import { categories } from "@/content/categories";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";
import { site } from "@/lib/site";
import { categoryIcons } from "../Icons";
import { ChoiceGroup, ConsentField, Honeypot, SelectField, TextArea, TextField, type Errors } from "./FormFields";
import { EMAIL_RE, list, orNull, str, useLeadForm } from "./useLeadForm";

export function HostForm({ lang, t }: { lang: Lang; t: Dictionary }) {
  const f = t.forms;
  const h = f.host;

  const validate = (data: FormData): Errors => ({
    first_name: str(data, "first_name") ? undefined : f.required,
    email: !str(data, "email") ? f.required : EMAIL_RE.test(str(data, "email")) ? undefined : f.invalidEmail,
    area: str(data, "area") ? undefined : f.required,
    space_type: str(data, "space_type") ? undefined : f.pickOne,
    heated: str(data, "heated") ? undefined : f.pickOne,
    size: str(data, "size") ? undefined : f.required,
    accepts: list(data, "accepts").length ? undefined : f.pickOne,
    consent: data.get("consent") === "yes" ? undefined : f.consentRequired,
  });

  const toPayload = (data: FormData) => ({
    first_name: str(data, "first_name"),
    email: str(data, "email").toLowerCase(),
    phone: orNull(str(data, "phone")),
    area: str(data, "area"),
    space_type: str(data, "space_type"),
    heated: str(data, "heated"),
    size: str(data, "size"),
    accepts: list(data, "accepts"),
    message: orNull(str(data, "message")),
    consent: true,
  });

  const { status, errors, onSubmit, successRef } = useLeadForm("host", lang, validate, toPayload);

  if (status === "success") {
    return (
      <div ref={successRef} tabIndex={-1} className="card p-6 text-center outline-none sm:p-10" role="status">
        <CheckCircle2 size={48} className="mx-auto text-pine" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-bold text-night">{h.successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{h.successText}</p>
        <Link prefetch={false} href={pagePath("trust", lang)} className="btn btn-secondary mt-6">
          {t.trust.link}
        </Link>
      </div>
    );
  }

  const areaOptions = [
    ...areas.map((a) => ({ value: a.slug, label: a.name })),
    { value: "other", label: f.otherArea },
  ];

  return (
    <form
      name="host-lead"
      noValidate
      onSubmit={onSubmit}
      className="card space-y-6 p-5 sm:p-8"
      aria-busy={status === "sending"}
    >
      <Honeypot />
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
          hint={f.phoneHintHost}
        />
        <SelectField
          name="area"
          label={f.area}
          placeholder={f.areaPlaceholder}
          options={areaOptions}
          required
          error={errors.area}
        />
      </div>

      <ChoiceGroup
        name="space_type"
        label={h.spaceType}
        options={Object.entries(h.spaceTypes).map(([value, label]) => ({ value, label }))}
        error={errors.space_type}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceGroup
          name="heated"
          label={h.heated}
          options={Object.entries(h.heatedOptions).map(([value, label]) => ({ value, label }))}
          error={errors.heated}
        />
        <SelectField
          name="size"
          label={h.size}
          placeholder="–"
          options={Object.entries(h.sizes).map(([value, label]) => ({ value, label }))}
          required
          error={errors.size}
        />
      </div>

      <ChoiceGroup
        name="accepts"
        label={h.accepts}
        multiple
        options={categories.map((c) => {
          const Icon = categoryIcons[c.id];
          return { value: c.id, label: c.name[lang], icon: <Icon size={18} /> };
        })}
        error={errors.accepts}
      />

      <TextArea name="message" label={f.message} placeholder={h.messagePlaceholder} optionalLabel={f.optional} />

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
        {status === "sending" ? f.sending : h.submit}
      </button>
    </form>
  );
}
