/**
 * Fee model and price helpers.
 *
 * Prices in the content files are what the RENTER pays per month, service fee
 * included (that is what renters see on the site). The host's price is that
 * amount without the renter service fee, and the host receives it minus the
 * host fee.
 */
export const FEES = {
  /** Added on top of the host's price, paid by the renter. */
  renterServiceFee: 0.15,
  /** Deducted from the host's payout. */
  hostFee: 0.05,
};

/** Price uplift for heated space, for categories where heat matters. */
export const HEATED_PREMIUM = 0.25;

export function renterPrice(basePrice: number, heated: boolean, heatedMatters: boolean): number {
  return heated && heatedMatters ? basePrice * (1 + HEATED_PREMIUM) : basePrice;
}

/** What the host receives for a given renter price. */
export function hostPayout(renterPricePaid: number): number {
  return (renterPricePaid / (1 + FEES.renterServiceFee)) * (1 - FEES.hostFee);
}

/** Round to a friendly number for display (nearest 10 kr). */
export function roundForDisplay(value: number): number {
  return Math.round(value / 10) * 10;
}
