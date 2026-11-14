import { describe, expect, it } from "vitest";
import { balanceSheet, incomeStatement, lineSum, neBasis, sieFile, sieOrgNumber, templateLines, toCp437, vatIncluded, type Balance } from "./bookkeeping";

describe("VAT templates", () => {
  it("purchase with 25 % VAT: cost, input VAT, paid from the bank", () => {
    const lines = templateLines("purchase25", 125, 6110, 1930);
    expect(lines).toEqual([
      { account: 6110, amount: 100 },
      { account: 2641, amount: 25 },
      { account: 1930, amount: -125 },
    ]);
    expect(lineSum(lines)).toBe(0);
  });

  it("12 % and 6 % VAT are worked out from the gross amount", () => {
    expect(vatIncluded(112, 12)).toBe(12);
    expect(vatIncluded(106, 6)).toBe(6);
    expect(lineSum(templateLines("purchase12", 99.9, 5800, 2018))).toBe(0);
  });

  it("service from another EU country: reverse charge in boxes 21, 30 and 48", () => {
    const lines = templateLines("eu_service", 100, 5910, 1930);
    expect(lines).toEqual([
      { account: 5910, amount: 100, vat_box: "21" },
      { account: 2645, amount: 25 },
      { account: 2614, amount: -25 },
      { account: 1930, amount: -100 },
    ]);
    expect(templateLines("non_eu_service", 100, 6540, 1930)[0].vat_box).toBe("22");
  });

  it("sale, withdrawal, deposit and VAT payment balance", () => {
    expect(templateLines("sale25", 1250, 3041, 1930)).toEqual([
      { account: 1930, amount: 1250 },
      { account: 3041, amount: -1000 },
      { account: 2611, amount: -250 },
    ]);
    for (const id of ["withdrawal", "deposit", "vat_payment", "purchase0"] as const) {
      expect(lineSum(templateLines(id, 333.33, 6570, 1930))).toBe(0);
    }
    expect(templateLines("purchase25", 0, 6110, 1930)).toEqual([]);
  });
});

const bal = (number: number, name: string, opening: number, debit: number, credit: number): Balance => ({
  number,
  name,
  opening,
  debit,
  credit,
  closing: opening + debit - credit,
});

describe("statements", () => {
  const balances = [
    bal(1930, "Företagskonto", 400, 1290, 265),
    bal(2010, "Eget kapital", 0, 0, 400),
    bal(2611, "Utgående moms", 0, 0, 250),
    bal(2641, "Ingående moms", 0, 25, 0),
    bal(3041, "Försäljning", 0, 0, 1000),
    bal(6110, "Kontorsmateriel", 0, 140, 40),
    bal(5910, "Annonsering", 0, 100, 0),
    bal(8999, "Årets resultat", 0, 0, 0),
  ];

  it("income statement: income positive, costs negative, result", () => {
    const s = incomeStatement(balances);
    expect(s.groups.map((g) => [g.label, g.total])).toEqual([
      ["Nettoomsättning", 1000],
      ["Övriga externa kostnader", -200],
    ]);
    expect(s.result).toBe(800);
  });

  it("balance sheet balances with this year's result added to equity", () => {
    const s = balanceSheet(balances, 800);
    expect(s.totalAssets).toBe(1425);
    expect(s.totalEquity).toBe(1425);
    // Input VAT (2641) is netted against output VAT among the short-term debts.
    expect(s.equity.find((g) => g.label === "Kortfristiga skulder")?.total).toBe(225);
  });

  it("NE basis: R1 sales, R6 other external costs, R11 result", () => {
    const ne = neBasis(balances);
    const r = Object.fromEntries(ne.result.map((x) => [x.box, x.amount]));
    expect(r.R1).toBe(1000);
    expect(r.R6).toBe(200);
    expect(r.R11).toBe(800);
  });
});

describe("SIE 4", () => {
  it("writes the header, balances and vouchers", () => {
    const text = sieFile(
      {
        year: 2026,
        accounts: [
          { number: 1930, name: "Företagskonto" },
          { number: 3041, name: "Försäljning tjänster, 25 % moms" },
        ],
        opening: { "1930": 400 },
        closing: { "1930": 1650 },
        result: { "3041": -1000 },
        vouchers: [
          {
            label: "A1",
            date: "2026-07-02",
            description: 'Faktura "Lund"',
            created_at: "2026-07-03T10:00:00Z",
            lines: [
              { account: 1930, amount: 1250, note: "" },
              { account: 3041, amount: -1250, note: "" },
            ],
          },
        ],
      },
      { name: "Spazia", orgNumber: "20061129-9595" },
      "2026-11-14",
    );
    expect(text).toContain("#FORMAT PC8\r\n#SIETYP 4");
    expect(text).toContain("#ORGNR 061129-9595");
    expect(text).toContain("#RAR 0 20260101 20261231");
    expect(text).toContain("#IB 0 1930 400.00");
    expect(text).toContain("#RES 0 3041 -1000.00");
    expect(text).toContain('#VER A 1 20260702 "Faktura \\"Lund\\"" 20260703\r\n{\r\n   #TRANS 1930 {} 1250.00');
  });

  it("encodes Swedish letters as code page 437", () => {
    expect(Array.from(toCp437("åäöÅÄÖ é–"))).toEqual([0x86, 0x84, 0x94, 0x8f, 0x8e, 0x99, 0x20, 0x82, 0x2d]);
    expect(sieOrgNumber("559000-1234")).toBe("559000-1234");
  });
});
