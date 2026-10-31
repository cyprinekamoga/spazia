"use client";

import { useRef, useState, type FormEvent } from "react";
import { submitLead, type LeadKind, type LeadPayload } from "@/lib/leads";
import { getAttribution, trackLead } from "@/lib/tracking";
import type { Errors } from "./FormFields";

type Status = "idle" | "sending" | "success" | "error";

/**
 * Shared submit logic for the lead forms: validate, attach attribution,
 * store the lead and fire the Meta "Lead" event.
 */
export function useLeadForm(
  kind: LeadKind,
  lang: string,
  validate: (data: FormData) => Errors,
  toPayload: (data: FormData) => LeadPayload,
) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const successRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const found = validate(data);
    const hasErrors = Object.values(found).some(Boolean);
    setErrors(found);
    if (hasErrors) {
      const firstKey = Object.keys(found).find((k) => found[k]);
      const el = firstKey
        ? (form.querySelector(`[name="${firstKey}"]`) as HTMLElement | null)
        : null;
      el?.focus();
      return;
    }

    // Honeypot filled in: pretend everything went fine.
    if (String(data.get("bot-field") ?? "").trim() !== "") {
      setStatus("success");
      return;
    }

    setStatus("sending");
    try {
      const attribution = getAttribution();
      await submitLead(kind, {
        ...toPayload(data),
        lang,
        utm_source: attribution.utm_source ?? null,
        utm_medium: attribution.utm_medium ?? null,
        utm_campaign: attribution.utm_campaign ?? null,
        utm_content: attribution.utm_content ?? null,
        utm_term: attribution.utm_term ?? null,
        referrer: attribution.referrer ?? null,
        landing_page: attribution.landing_page ?? null,
      });
      trackLead(kind);
      setStatus("success");
      requestAnimationFrame(() => {
        successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        successRef.current?.focus();
      });
    } catch {
      setStatus("error");
    }
  }

  return { status, errors, onSubmit, successRef };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function str(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

export function list(data: FormData, key: string): string[] {
  return data.getAll(key).map(String);
}

export function orNull(value: string): string | null {
  return value === "" ? null : value;
}
