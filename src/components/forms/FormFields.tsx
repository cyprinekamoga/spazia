"use client";

import type { ReactNode } from "react";
import { townSuggestions } from "@/content/cities";

export type Errors = Record<string, string | undefined>;

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-[#b42318]">
      {message}
    </p>
  );
}

export function TextField({
  name,
  label,
  type = "text",
  required,
  optionalLabel,
  hint,
  error,
  autoComplete,
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel";
}) {
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {!required && optionalLabel && <span className="ml-1 font-normal text-muted">({optionalLabel})</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field-input"
        maxLength={200}
        enterKeyHint="next"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Town (free text with suggestions). The note under it says whether the
 * town is open yet or on the waitlist; it is announced when it changes.
 */
export function TownField({
  label,
  placeholder,
  value,
  onChange,
  error,
  note,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  note?: string;
}) {
  const id = "f-city";
  const describedBy = [`${id}-note`, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name="city"
        type="text"
        required
        list={`${id}-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="address-level2"
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field-input [&::-webkit-calendar-picker-indicator]:hidden!"
        maxLength={80}
        enterKeyHint="next"
      />
      <datalist id={`${id}-list`}>
        {townSuggestions.map((town) => (
          <option key={town} value={town} />
        ))}
      </datalist>
      <p id={`${id}-note`} aria-live="polite" className="text-sm leading-snug text-brand empty:hidden [&:not(:empty)]:mt-1.5">
        {note}
      </p>
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  placeholder,
  required,
  error,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const id = `f-${name}`;
  const controlled = value !== undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field-input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2313213a%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_0.9rem_center] bg-no-repeat pr-10"
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: "" })}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

/** Radio or checkbox group rendered as tappable chips. */
export function ChoiceGroup({
  name,
  label,
  options,
  multiple = false,
  error,
  selected,
  onToggle,
  optionalLabel,
}: {
  name: string;
  label: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  multiple?: boolean;
  error?: string;
  /** Controlled selection (used for pre-filling from the URL). */
  selected?: string[];
  onToggle?: (value: string) => void;
  optionalLabel?: string;
}) {
  const id = `f-${name}`;
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="field-label">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">({optionalLabel})</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const controlledProps =
            selected !== undefined
              ? { checked: selected.includes(o.value), onChange: () => onToggle?.(o.value) }
              : {};
          return (
            <label key={o.value} className="relative cursor-pointer">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                className="peer sr-only"
                {...controlledProps}
              />
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-paper px-4 py-2 text-[0.95rem] font-medium text-ink transition-colors peer-hover:border-frost-2 peer-checked:border-night peer-checked:bg-night peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-bright">
                {o.icon}
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      <ErrorText id={`${id}-error`} message={error} />
    </fieldset>
  );
}

export function TextArea({
  name,
  label,
  placeholder,
  optionalLabel,
}: {
  name: string;
  label: string;
  placeholder?: string;
  optionalLabel?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">({optionalLabel})</span>}
      </label>
      <textarea id={id} name={name} rows={3} placeholder={placeholder} className="field-input resize-y" maxLength={1000} />
    </div>
  );
}

export function ConsentField({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "f-consent-error" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#2f6b75]"
        />
        <span className="text-[0.95rem] leading-relaxed text-ink">{children}</span>
      </label>
      <ErrorText id="f-consent-error" message={error} />
    </div>
  );
}

/** Hidden field bots tend to fill in. Netlify Forms uses it as a honeypot too. */
export function Honeypot() {
  return (
    <p className="hidden" aria-hidden="true">
      <label>
        Fyll inte i detta: <input name="bot-field" tabIndex={-1} autoComplete="off" />
      </label>
    </p>
  );
}
