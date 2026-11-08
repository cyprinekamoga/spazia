"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Dictionary } from "@/content";
import { tidyTown } from "@/content/cities";
import { fill, type Lang } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";
import { site } from "@/lib/site";
import { ChoiceGroup, ConsentField, Honeypot, SelectField, TextArea, TextField, TownField, type Errors } from "./FormFields";
import { EMAIL_RE, orNull, str, useLeadForm } from "./useLeadForm";

/** For housing companies, student unions, businesses and associations. */
export function OrgForm({ lang, t }: { lang: Lang; t: Dictionary }) {
  const f = t.forms;
  const o = f.org;
  const [town, setTown] = useState("");
  const options = (record: Record<string, string>) => Object.entries(record).map(([value, label]) => ({ value, label }));

  const validate = (data: FormData): Errors => ({
    org_name: str(data, "org_name") ? undefined : f.required,
    first_name: str(data, "first_name") ? undefined : f.required,
    email: !str(data, "email") ? f.required : EMAIL_RE.test(str(data, "email")) ? undefined : f.invalidEmail,
    org_type: str(data, "org_type") ? undefined : f.required,
    org_need: str(data, "org_need") ? undefined : f.pickOne,
    city: str(data, "city") ? undefined : f.required,
    consent: data.get("consent") === "yes" ? undefined : f.consentRequired,
  });

  const toPayload = (data: FormData) => ({
    org_name: str(data, "org_name"),
    first_name: str(data, "first_name"),
    email: str(data, "email").toLowerCase(),
    phone: orNull(str(data, "phone")),
    org_type: str(data, "org_type"),
    org_need: str(data, "org_need"),
    city: tidyTown(str(data, "city")),
    message: orNull(str(data, "message")),
    consent: true,
  });

  const { status, errors, onSubmit, successRef } = useLeadForm("org", lang, validate, toPayload);

  if (status === "success") {
    return (
      <div ref={successRef} tabIndex={-1} className="card p-6 text-center outline-none sm:p-10" role="status">
        <CheckCircle2 size={48} className="mx-auto text-pine" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-bold text-night">{o.successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{o.successText}</p>
      </div>
    );
  }

  return (
    <form name="org-lead" noValidate onSubmit={onSubmit} className="card space-y-6 p-5 sm:p-8" aria-busy={status === "sending"}>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="org_name" label={o.orgName} required autoComplete="organization" error={errors.org_name} />
        <SelectField name="org_type" label={o.orgType} placeholder="–" options={options(o.orgTypes)} required error={errors.org_type} />
        <TextField name="first_name" label={o.contactName} required autoComplete="name" error={errors.first_name} />
        <TextField name="email" label={f.email} type="email" inputMode="email" required autoComplete="email" error={errors.email} />
        <TextField name="phone" label={f.phone} type="tel" inputMode="tel" autoComplete="tel" optionalLabel={f.optional} />
        <TownField label={f.town} placeholder={f.townPlaceholder} value={town} onChange={setTown} error={errors.city} />
      </div>

      <ChoiceGroup name="org_need" label={o.need} options={options(o.needs)} error={errors.org_need} />

      <TextArea name="message" label={o.message} placeholder={o.messagePlaceholder} optionalLabel={f.optional} />

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
        {status === "sending" ? f.sending : o.submit}
      </button>
    </form>
  );
}
