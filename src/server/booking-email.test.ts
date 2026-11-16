import { describe, expect, it } from "vitest";
import { buildBookingEmail, type NotificationPayload } from "./booking-email";

const opts = { appUrl: "https://app.spazia.se", team: "team@example.com" };

const base: NotificationPayload = {
  kind: "payout_setup",
  lang: "sv",
  prev_status: "paid",
  role: "host",
  to_email: "host@example.com",
  to_name: "Hanna",
  other_name: "Rolf",
  request_id: "11111111-1111-4111-8111-111111111111",
  request_kind: "month",
  start_date: "2026-12-01",
  end_date: null,
  start_at: null,
  end_at: null,
  host_total: null,
  message: "",
  expires_at: "2026-11-20T12:00:00Z",
  decline_reason: "",
  cancel_reason: "",
  listing_title: "Garage på Bergnäset",
  listing_city: "Luleå",
  listing_area: "Bergnäset",
  items: [{ category: "tyres", quantity: 2, host_price_month: 59, hourly_price: null, daily_max: null }],
  payment: { amount: 130, host_amount: 112, status: "paid", period_start: "2026-12-01", period_end: "2026-12-31", pay_by: "2026-11-22T12:00:00Z", failure: "" },
};

describe("payout_setup email", () => {
  it("tells the host money has come in and links to the payout page", () => {
    const mail = buildBookingEmail(base, opts)!;
    expect(mail.to).toBe("host@example.com");
    expect(mail.subject).toBe("Rolf har betalat, 112 kr till dig. Lägg till ditt bankkonto");
    expect(mail.text).toContain("Din del: 112 kr");
    expect(mail.text).toContain("dagen efter att perioden är slut");
    expect(mail.text).toContain("Lägg till bankkonto: https://app.spazia.se/vard/utbetalningar");
  });

  it("has a reminder version for money that is ready to pay out", () => {
    const mail = buildBookingEmail({ ...base, prev_status: "reminder" }, opts)!;
    expect(mail.subject).toBe("Dina pengar väntar: 112 kr. Lägg till ditt bankkonto");
    expect(mail.text).toContain("inget bankkonto att skicka den till");
  });

  it("is in English for English users", () => {
    const mail = buildBookingEmail({ ...base, lang: "en" }, opts)!;
    expect(mail.subject).toBe("Rolf has paid, 112 kr for you. Add your bank account");
    expect(mail.text).toContain("Add bank account: https://app.spazia.se/vard/utbetalningar");
  });
});
