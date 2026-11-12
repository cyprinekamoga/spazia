import { describe, expect, it } from "vitest";
import { searchMatchEmail, waitlistListingEmail } from "./alert-email";

const listing = { id: "11111111-1111-4111-8111-111111111111", title: "Torrt förråd", city: "Uppsala", area_name: "Luthagen", size_m2: 6, price_month: 115, price_hour: null };
const opts = { appUrl: "https://app.spazia.se", team: "team@example.com" };

describe("new-listing emails", () => {
  it("lists the matches and links to them and to the search", () => {
    const mail = searchMatchEmail({ kind: "search_match", to_email: "r@example.com", to_name: "Rolf", lang: "sv", alert: { id: "a", place: "Uppsala", category: "boxes", max_price: null }, listings: [listing, { ...listing, id: "22222222-2222-4222-8222-222222222222" }] }, opts)!;
    expect(mail.subject).toBe("2 nya platser i Uppsala");
    expect(mail.text).toContain("Torrt förråd · Luthagen, Uppsala · 6 m² · från 115 kr/mån");
    expect(mail.text).toContain(`https://app.spazia.se/annons?id=${listing.id}`);
    expect(mail.text).toContain("https://app.spazia.se/sok?ort=Uppsala&typ=boxes");
    expect(mail.html).toContain("Meny → Bevakningar");
  });

  it("is in English for English users, and empty when nothing matches", () => {
    const en = searchMatchEmail({ kind: "search_match", to_email: "r@example.com", to_name: null, lang: "en", alert: { id: "a", place: "Uppsala", category: null, max_price: null }, listings: [listing] }, opts)!;
    expect(en.subject).toBe("New space in Uppsala: Torrt förråd");
    expect(en.text).toContain("&lang=en");
    expect(searchMatchEmail({ kind: "search_match", to_email: "r@example.com", to_name: null, alert: { id: "a", place: "X", category: null, max_price: null }, listings: [] }, opts)).toBeNull();
  });

  it("tells the waitlist, with a way out", () => {
    const mail = waitlistListingEmail({ id: "x", kind: "renter", createdAt: "", data: { email: "w@example.com", first_name: "Wilma", city: "uppsala", lang: "sv" } }, { ...listing, categories: ["boxes"] }, opts)!;
    expect(mail.subject).toBe("Nu finns det plats i Uppsala på Spazia");
    expect(mail.text).toContain("Svara på mejlet, så tar vi bort dig");
  });
});
