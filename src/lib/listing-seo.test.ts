import { describe, expect, it } from "vitest";
import { categories } from "@/content/categories";
import { FEES } from "@/content/pricing";
import { renterPrice } from "@/lib/app/model";
import { SERVICE_FEE } from "../../netlify/lib/listing-shared";
import { clip, listingSeo, lowestPrice, renterPriceFor, SEO_CATEGORY_NAMES, seoHeadTags } from "./listing-seo";

const listing = {
  id: "af04a897-f298-4005-955a-a5710b85b090",
  title: "Uthus eller förråd i Porsön",
  description: "Torrt och låst, nära bussen.",
  city: "Luleå",
  area_name: "Porsön",
  size_m2: 10,
  listing_spaces: [
    { category: "tyres", host_price_month: 50, hourly_price: null },
    { category: "bikes", host_price_month: 80, hourly_price: null },
  ],
  listing_photos: [
    { path: "u/l/b.jpg", position: 1 },
    { path: "u/l/a.jpg", position: 0 },
  ],
};
const opts = { lang: "sv" as const, appUrl: "https://app.spazia.se", storageUrl: "https://x.supabase.co", serviceFee: FEES.renterServiceFee };

describe("listing SEO", () => {
  it("uses the same fee as the app and the edge function", () => {
    expect(SERVICE_FEE).toBe(FEES.renterServiceFee);
    for (const p of [1, 49, 50, 99, 100, 133, 1999]) expect(renterPriceFor(p, FEES.renterServiceFee)).toBe(renterPrice(p));
  });

  it("names every category", () => {
    for (const c of categories) {
      expect(SEO_CATEGORY_NAMES[c.id]?.sv).toBeTruthy();
      expect(SEO_CATEGORY_NAMES[c.id]?.en).toBeTruthy();
    }
  });

  it("builds title, description, canonical and structured data", () => {
    const seo = listingSeo(listing, opts);
    expect(seo.title).toBe("Uthus eller förråd i Porsön, Luleå | Spazia");
    expect(seo.description).toBe("Däckförvaring och cykelförvaring att hyra i Porsön, Luleå. Från 58 kr/mån, 10 m². Torrt och låst, nära bussen.");
    expect(seo.canonical).toBe(`https://app.spazia.se/annons?id=${listing.id}`);
    expect(seo.alternates.en).toBe(`https://app.spazia.se/annons?id=${listing.id}&lang=en`);
    expect(seo.image).toBe("https://x.supabase.co/storage/v1/object/public/listing-photos/u/l/a.jpg");
    expect(seo.jsonLd).toMatchObject({ "@type": "Product", offers: { price: 58, priceCurrency: "SEK" } });
  });

  it("does not repeat the town when the title has it", () => {
    expect(listingSeo({ ...listing, title: "Garage i Luleå centrum" }, opts).title).toBe("Garage i Luleå centrum | Spazia");
  });

  it("prefers monthly prices, falls back to hourly", () => {
    expect(lowestPrice([{ category: "parking", host_price_month: null, hourly_price: 20 }], 0.15)).toEqual({ amount: 23, per: "hour" });
    expect(lowestPrice([], 0.15)).toBeNull();
  });

  it("escapes what goes into the page head", () => {
    const tags = seoHeadTags(listingSeo({ ...listing, title: 'Förråd "bäst" </script><b>', description: "<img src=x>" }, opts), "sv");
    expect(tags).not.toContain("</script><b>");
    expect(tags).not.toContain("<img");
    expect(tags).toContain("&quot;bäst&quot;");
  });

  it("clips at a word", () => {
    expect(clip("ett två tre fyra", 10)).toBe("ett två…");
    expect(clip("kort", 10)).toBe("kort");
  });
});
