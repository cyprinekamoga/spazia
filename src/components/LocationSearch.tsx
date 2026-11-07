"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, type FormEvent } from "react";
import { townSuggestions } from "@/content/cities";
import { RENTER_PARAMS } from "@/lib/routes";

/**
 * "Where do you need space?" in the hero. Sends the visitor to the app's
 * search (an absolute URL) or to the renter form with the town filled in.
 * Works as a plain GET form without JavaScript.
 */
export function LocationSearch({
  action,
  label,
  placeholder,
  button,
  note,
}: {
  action: string;
  label: string;
  placeholder: string;
  button: string;
  note: string;
}) {
  const router = useRouter();
  const id = useId();
  const inputId = `${id}-town`;
  const listId = `${id}-towns`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const town = String(new FormData(event.currentTarget).get(RENTER_PARAMS.town) ?? "").trim();
    const query = town ? `?${RENTER_PARAMS.town}=${encodeURIComponent(town)}` : "";
    // The app is a separate site (app.spazia.se), so this is a full page load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- absolute URL to another site
    if (/^https?:/.test(action)) window.location.assign(`${action}${query}`);
    else router.push(`${action}${query}#anmalan`);
  }

  return (
    <form action={action} method="get" onSubmit={onSubmit} className="w-full max-w-xl">
      <label htmlFor={inputId} className="block text-[0.95rem] font-semibold text-frost">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-1.5 rounded-full bg-snow p-1.5 shadow-lg shadow-night/30 focus-within:ring-3 focus-within:ring-glow/60">
        <MapPin size={20} className="ml-2 shrink-0 text-brand" aria-hidden="true" />
        <input
          id={inputId}
          name={RENTER_PARAMS.town}
          list={listId}
          placeholder={placeholder}
          autoComplete="address-level2"
          enterKeyHint="search"
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-muted focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden!"
        />
        <button type="submit" className="btn btn-primary shrink-0 !px-4 sm:!px-6">
          {button}
        </button>
      </div>
      <datalist id={listId}>
        {townSuggestions.map((town) => (
          <option key={town} value={town} />
        ))}
      </datalist>
      <p className="mt-2.5 text-sm leading-snug text-frost-2">{note}</p>
    </form>
  );
}
