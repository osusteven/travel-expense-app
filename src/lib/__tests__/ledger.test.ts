import { describe, expect, it } from "vitest";
import { type Entry, entryEffect, settlement, summarize } from "../ledger";
import { convertMinor, currencyExponent, formatMoney, parseDecimal, toMinor } from "../money";
import { parseEntryForm } from "../validate";
import { toCsv } from "../export";
import Decimal from "decimal.js";

let n = 0;
const TRIP = "11111111-2222-4333-8444-555555555555";
function entry(p: Partial<Entry>): Entry {
  n++;
  return {
    id: `e${n}`, tripId: TRIP, method: null, kind: "expense", date: "2026-10-01", description: "x", amountMinor: 10000, currency: "USD",
    rate: "1", rateSource: "same", rateDate: "2026-10-01", homeAmountMinor: null, paidBy: "p1", split: "equal",
    p1ShareMinor: null, notes: "", createdAt: `2026-10-01T00:00:${String(n).padStart(2, "0")}Z`, updatedAt: "2026-10-01T00:00:00Z", ...p,
  };
}

describe("money", () => {
  it("knows currency decimals", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("KWD")).toBe(3);
  });
  it("parses the ways people type numbers", () => {
    expect(parseDecimal("12.50")!.toFixed()).toBe("12.5");
    expect(parseDecimal("12,50")!.toFixed()).toBe("12.5");
    expect(parseDecimal("1,234")!.toFixed()).toBe("1234");
    expect(parseDecimal("1,234.56")!.toFixed()).toBe("1234.56");
    expect(parseDecimal("1.234,56")!.toFixed()).toBe("1234.56");
    expect(parseDecimal("1 234,5")!.toFixed()).toBe("1234.5");
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });
  it("rejects more decimals than the currency has", () => {
    expect(toMinor(new Decimal("12.5"), "JPY")).toBeNull();
    expect(toMinor(new Decimal("1250"), "JPY")).toBe(1250);
    expect(toMinor(new Decimal("12.34"), "USD")).toBe(1234);
  });
  it("converts without floating point error and rounds once", () => {
    // ¥10,000 at 0.0067 = $67.00 exactly
    expect(convertMinor(10000, "JPY", "USD", "0.0067")).toBe(6700);
    // €0.10 × 3 separately would drift with floats; here 10 cents at 1.1 = 11 cents
    expect(convertMinor(10, "EUR", "USD", "1.1")).toBe(11);
    // half-up rounding: $1.005 → $1.01
    expect(convertMinor(1005, "KWD", "USD", "1")).toBe(101);
  });
  it("formats", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatMoney(10000, "JPY")).toBe("¥10,000");
  });
});

describe("ledger", () => {
  it("equal split: the other person owes half", () => {
    const s = summarize([entry({ amountMinor: 10000 })], "USD");
    expect(s.balance).toBe(5000);
    expect(settlement(s.balance)).toEqual({ from: "p2", to: "p1", amount: 5000 });
  });
  it("odd cent stays with the payer", () => {
    const fx = entryEffect(entry({ amountMinor: 1001, paidBy: "p2" }), "USD");
    expect(fx.share).toEqual({ p1: 500, p2: 501 });
    expect(fx.balanceDelta).toBe(-500);
  });
  it("no split modes", () => {
    expect(entryEffect(entry({ split: "payer" }), "USD").balanceDelta).toBe(0);
    expect(entryEffect(entry({ split: "other", paidBy: "p2" }), "USD").balanceDelta).toBe(-10000);
  });
  it("custom split", () => {
    const fx = entryEffect(entry({ split: "custom", p1ShareMinor: 7000 }), "USD");
    expect(fx.share).toEqual({ p1: 7000, p2: 3000 });
    expect(fx.balanceDelta).toBe(3000);
  });
  it("foreign currency uses the stored rate", () => {
    const fx = entryEffect(entry({ amountMinor: 84000, currency: "JPY", rate: "0.0067", paidBy: "p2" }), "USD");
    expect(fx.home).toBe(56280);
    expect(fx.balanceDelta).toBe(-28140);
  });
  it("charged amount overrides the rate, custom split scales with it", () => {
    const e = entry({ amountMinor: 12000, currency: "JPY", rate: "0.0068", homeAmountMinor: 8200, split: "custom", p1ShareMinor: 4000 });
    const fx = entryEffect(e, "USD");
    expect(fx.home).toBe(8200);
    expect(fx.share.p1 + fx.share.p2).toBe(8200);
    expect(fx.share.p1).toBe(2733);
  });
  it("payment settles and isn't counted as spending", () => {
    const s = summarize([entry({ amountMinor: 10000 }), entry({ kind: "payment", amountMinor: 5000, paidBy: "p2", split: "other" })], "USD");
    expect(s.balance).toBe(0);
    expect(s.totalSpent).toBe(10000);
  });
});

describe("form validation", () => {
  const base = { kind: "expense", date: "2026-10-05", description: "Dinner", amount: "3400", currency: "JPY", paidBy: "p1", split: "equal", rate: "0.0067", rateSource: "ecb", rateDate: "2026-10-03" };
  it("accepts a valid foreign expense", () => {
    const r = parseEntryForm(base, "USD");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ amountMinor: 3400, rate: "0.0067", rateSource: "ecb", rateDate: "2026-10-03" });
  });
  it("computes the rate from the charged amount", () => {
    const r = parseEntryForm({ ...base, rateMode: "charged", homeAmount: "23.10" }, "USD");
    expect(r.ok && r.value.homeAmountMinor).toBe(2310);
  });
  it("reports errors per field", () => {
    const r = parseEntryForm({ ...base, amount: "12.5", rate: "" }, "USD");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["amount", "rate"]);
  });
  it("custom share can't exceed the total", () => {
    const r = parseEntryForm({ ...base, split: "custom", p1Share: "5000" }, "USD");
    expect(r.ok).toBe(false);
  });
});

describe("csv export", () => {
  it("escapes and guards against spreadsheet formulas", () => {
    const csv = toCsv([entry({ description: '=HYPERLINK("x"), "quoted"' })], "USD", { p1: "Steven", p2: "Partner" });
    expect(csv.startsWith("\uFEFFtrip,date,type")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x""), ""quoted"""`);
    expect(csv).toContain(",50.00,");
  });
});

import { computeStats, historyItems } from "../stats";
import { countrySlots } from "../currencyData";

describe("statistics", () => {
  const entries = [
    entry({ date: "2026-10-01", amountMinor: 10000, currency: "USD" }),
    entry({ date: "2026-10-03", amountMinor: 20000, currency: "JPY", rate: "0.01", paidBy: "p2" }),
    entry({ date: "2026-10-03", amountMinor: 5000, currency: "USD", split: "payer" }),
    entry({ kind: "payment", date: "2026-10-04", amountMinor: 1000, currency: "USD", split: "other", paidBy: "p2" }),
  ];
  it("totals by country, days and per-day average", () => {
    const s = computeStats(entries, "USD");
    expect(s.totalSpent).toBe(35000);
    expect(s.days).toBe(3);
    expect(s.perDay).toBe(11667);
    expect(s.byCountry.map((c) => [c.currency, c.home])).toEqual([["JPY", 20000], ["USD", 15000]]);
    expect(s.periods.map((p) => p.total)).toEqual([10000, 0, 25000]);
    expect(s.largest?.home).toBe(20000);
    expect(s.payments).toEqual({ count: 1, total: 1000 });
  });
  it("assigns country colors in order of first use and never reuses them", () => {
    const codes = ["USD", "JPY", "USD", "EUR", "KRW", "THB", "VND", "GBP", "MXN", "CAD"];
    const slots = countrySlots(codes);
    expect(slots).toMatchObject({ USD: 1, JPY: 2, EUR: 0, VND: 0, CAD: 0 });
  });
  it("history carries running balance and country", () => {
    const h = historyItems(entries, "USD");
    const jpy = h.find((i) => i.currency === "JPY")!;
    expect(jpy.country).toBe("Japan");
    expect(jpy.slot).toBe(2);
    expect(h.find((i) => i.kind === "payment")!.balanceAfter).toBe(5000 - 10000 + 1000 * -1 + 0);
  });
});

import { parseImport } from "../importData";
import { toJson as exportJson } from "../export";

describe("import", () => {
  const people = { p1: "Steven", p2: "Alex" };
  const original = [
    entry({ id: "0b1e7d7c-8f4e-4a59-9a39-5f6d1f0c2a11", currency: "JPY", amountMinor: 3400, rate: "0.0067", rateSource: "ecb", notes: "ramen" }),
    entry({ id: "4f7a2a3e-1b2c-4d5e-8f90-123456789abc", kind: "payment", split: "other", paidBy: "p2", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" }),
  ];
  const trip = { id: TRIP, name: "Japan", slug: "japan", createdAt: "2026-10-01T00:00:00Z" };
  it("round-trips a JSON export exactly (trips, entries, settings)", () => {
    const profiles = { p1: { venmo: "steven-b" }, p2: { photo: "data:image/jpeg;base64,AAAA" } };
    const text = JSON.stringify(
      exportJson(original, "USD", people, { enabledCurrencies: ["USD", "JPY"], profiles, currentTripId: TRIP }, [trip]),
    );
    const parsed = parseImport(text, "USD");
    expect(parsed.entries).toEqual(original);
    expect(parsed.trips).toEqual([trip]);
    expect(parsed.enabledCurrencies).toEqual(["USD", "JPY"]);
    expect(parsed.profiles).toEqual(profiles);
    expect(parsed.currentTripId).toBe(TRIP);
  });
  it("imports files from before trips existed into one new trip", () => {
    const v1 = JSON.parse(JSON.stringify(exportJson(original, "USD", people)));
    delete v1.trips;
    for (const e of v1.entries) {
      delete e.tripId;
      delete e.method;
    }
    const parsed = parseImport(JSON.stringify(v1), "USD");
    expect(parsed.trips).toHaveLength(1);
    expect(parsed.trips[0].name).toMatch(/^Imported /);
    expect(parsed.entries.every((e) => e.tripId === parsed.trips[0].id && e.method === null)).toBe(true);
  });
  it("rejects a different home currency, bad JSON, and invalid entries", () => {
    const text = JSON.stringify(exportJson(original, "USD", people, {}, [trip]));
    expect(() => parseImport(text, "EUR")).toThrow(/home currency/);
    expect(() => parseImport("date,amount\n1,2", "USD")).toThrow(/valid JSON/);
    const bad = JSON.parse(text);
    bad.entries[0].amountMinor = -5;
    expect(() => parseImport(JSON.stringify(bad), "USD")).toThrow(/Entry 1 is invalid/);
  });
});

describe("trips", () => {
  const OTHER = "99999999-2222-4333-8444-555555555555";
  it("CSV keeps a separate running balance per trip", () => {
    const entries = [
      entry({ tripId: TRIP, amountMinor: 10000 }),
      entry({ tripId: OTHER, amountMinor: 4000, paidBy: "p2" }),
    ];
    const csv = toCsv(entries, "USD", { p1: "Browning", p2: "McAlonis" }, [
      { id: TRIP, name: "Japan", slug: "japan", createdAt: "" },
      { id: OTHER, name: "Lisbon", slug: "lisbon", createdAt: "" },
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain("trip,date");
    expect(lines.find((l) => l.startsWith("Japan"))).toContain(",50.00,");
    expect(lines.find((l) => l.startsWith("Lisbon"))).toContain(",-20.00,");
  });
  it("a full payment brings a trip to exactly zero", () => {
    const e = [entry({ amountMinor: 12345 })];
    const owed = settlement(summarize(e, "USD").balance)!;
    e.push(entry({ kind: "payment", amountMinor: owed.amount, paidBy: owed.from, split: "other", method: "venmo" }));
    expect(summarize(e, "USD").balance).toBe(0);
  });
});

import { slugify } from "../ledger";
import { homeFirst } from "../currencyOptions";

describe("trip addresses and currency order", () => {
  it("makes web-friendly trip addresses", () => {
    expect(slugify("Japan & Korea 2026")).toBe("japan-korea-2026");
    expect(slugify("  Côte d'Azur!! ")).toBe("cote-d-azur");
    expect(slugify("New")).toBe("new-trip");
    expect(slugify("🎉")).toBe("trip");
  });
  it("lists the home currency first, then alphabetically", () => {
    expect(homeFirst("USD", ["THB", "EUR", "USD", "JPY"])).toEqual(["USD", "EUR", "JPY", "THB"]);
  });
});
