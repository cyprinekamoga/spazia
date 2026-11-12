// deno test --no-config --node-modules-dir=none supabase/functions/_shared/
import { scheduleParams, type SchedulePlan } from "./schedule.ts";

function assertEquals(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
}

const products = { rent: "prod_rent", fee: "prod_fee", protection: "prod_prot" };
const base: SchedulePlan = {
  start: 2_000_000_000,
  start_date: "2033-05-18",
  monthly: 230,
  monthly_base: 200,
  months: null,
  last: null,
  last_base: null,
  title: "Förråd",
  host_name: "Hanna",
};
const opts = { customer: "cus_1", paymentMethod: "pm_1", products, requestId: "req_1", now: 1_900_000_000 };
const lines = (p: ReturnType<typeof scheduleParams>, phase = 0) =>
  p!.phases![phase].items.map((i) => [(i.price_data as { product: string }).product, (i.price_data as { unit_amount: number }).unit_amount]);

Deno.test("rent and fee, no add-on", () => {
  assertEquals(lines(scheduleParams(base, opts)), [["prod_rent", 20000], ["prod_fee", 3000]]);
});

Deno.test("Spazia Skydd is its own line; the fee is what is left", () => {
  const p = scheduleParams({ ...base, monthly: 242, monthly_protection: 12 }, opts);
  assertEquals(lines(p), [["prod_rent", 20000], ["prod_fee", 3000], ["prod_prot", 1200]]);
});

Deno.test("a last, shorter month carries its own prorated add-on", () => {
  const p = scheduleParams({ ...base, monthly: 242, monthly_protection: 12, months: 2, last: 121, last_base: 100, last_protection: 6 }, opts);
  assertEquals(p!.phases!.length, 2);
  assertEquals(lines(p, 1), [["prod_rent", 10000], ["prod_fee", 1500], ["prod_prot", 600]]);
});

Deno.test("never charges more than the month's total", () => {
  const p = scheduleParams({ ...base, monthly: 205, monthly_protection: 50 }, opts);
  const sum = lines(p).reduce((s, [, ore]) => s + (ore as number), 0);
  assertEquals(sum, 20500);
});

Deno.test("an old plan without the field still works", () => {
  const { monthly_protection: _, ...old } = { ...base, monthly_protection: undefined };
  assertEquals(lines(scheduleParams(old as SchedulePlan, opts)), [["prod_rent", 20000], ["prod_fee", 3000]]);
});
