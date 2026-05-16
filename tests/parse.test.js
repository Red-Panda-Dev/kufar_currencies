import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CURRENCY_SYMBOLS,
  DISPLAY_CURRENCIES,
  convert,
  convertFromBYN,
  formatDate,
  formatDisplayPrice,
  formatRate,
  formatRateLabel,
  formatTime,
  parseBynPrice,
  parseRates,
} from "../src/lib/rates.js";

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "examples", "nbrb_response.json"),
    "utf8",
  ),
);

describe("parseRates", () => {
  it("extracts USD EUR RUB from fixture", () => {
    const parsed = parseRates(fixture);
    expect(parsed).not.toBeNull();
    expect(parsed.rates.USD.code).toBe("USD");
    expect(parsed.rates.EUR.code).toBe("EUR");
    expect(parsed.rates.RUB.code).toBe("RUB");
    expect(parsed.rates.RUB.scale).toBe(100);
  });

  it("returns null for invalid payload", () => {
    expect(parseRates(null)).toBeNull();
    expect(parseRates({})).toBeNull();
  });

  it("returns null when required rate is missing", () => {
    const withoutRub = fixture.filter(
      (item) => item.Cur_Abbreviation !== "RUB",
    );
    expect(parseRates(withoutRub)).toBeNull();
  });
});

describe("conversion helpers", () => {
  it("converts currency to BYN with scale", () => {
    const parsed = parseRates(fixture);
    const amount = convert(100, parsed.rates.RUB);
    expect(amount).toBeCloseTo(3.7556, 5);
  });

  it("converts BYN to currency with scale", () => {
    const parsed = parseRates(fixture);
    const amount = convertFromBYN(3.7556, parsed.rates.RUB);
    expect(amount).toBeCloseTo(100, 5);
  });

  it("convertFromBYN returns null for invalid rateInfo", () => {
    expect(convertFromBYN(100, null)).toBeNull();
    expect(convertFromBYN(100, { scale: 0, rate: 1 })).toBeNull();
    expect(convertFromBYN(100, { scale: 1, rate: -1 })).toBeNull();
  });
});

describe("price parsing and formatting", () => {
  it("parses BYN prices with spaces and decimal separators", () => {
    expect(parseBynPrice("96 912 р.")).toEqual({
      amount: 96912,
      unitSuffix: "",
    });
    expect(parseBynPrice("96\u00A0912 р.")).toEqual({
      amount: 96912,
      unitSuffix: "",
    });
    expect(parseBynPrice("96\u202F912 р.")).toEqual({
      amount: 96912,
      unitSuffix: "",
    });
    expect(parseBynPrice("от 10,5 BYN")).toEqual({
      amount: 10.5,
      unitSuffix: "",
    });
    expect(parseBynPrice("10.25 бел. руб")).toEqual({
      amount: 10.25,
      unitSuffix: "",
    });
  });

  it("returns null for non-BYN strings", () => {
    expect(parseBynPrice("Цена не указана")).toBeNull();
    expect(parseBynPrice("$ 100")).toBeNull();
    expect(parseBynPrice("до 100 000 р. на срок до 7 лет")).toBeNull();
    expect(parseBynPrice("На Куфаре с мая, 2023")).toBeNull();
    expect(parseBynPrice("От 2 000 до 17 449 р.")).toBeNull();
    expect(
      parseBynPrice(
        "2007 г., 225 063 км, механика, 2.0 л, бензин, внедорожник",
      ),
    ).toBeNull();
  });

  it("extracts unit suffixes from per-unit prices", () => {
    expect(parseBynPrice("1 246 р. / мес.")).toEqual({
      amount: 1246,
      unitSuffix: " / мес.",
    });
    expect(parseBynPrice("6 096.86 р. / м²")).toEqual({
      amount: 6096.86,
      unitSuffix: " / м²",
    });
    expect(parseBynPrice("1 136 р. / мес.")).toEqual({
      amount: 1136,
      unitSuffix: " / мес.",
    });
  });

  it("parses prices with Latin p as BYN marker", () => {
    expect(parseBynPrice("6 096.86 p. / м²")).toEqual({
      amount: 6096.86,
      unitSuffix: " / м²",
    });
    expect(parseBynPrice("214 000 p.")).toEqual({
      amount: 214000,
      unitSuffix: "",
    });
  });

  it("formats display and rate labels", () => {
    expect(formatDisplayPrice(1234.5, "USD")).toContain("$");
    expect(formatRate(2.8186)).toBe("2.8186");
    expect(formatRateLabel("USD", 1)).toBe("BYN за 1 USD");
    expect(formatRateLabel("RUB", 100)).toBe("BYN за 100 RUB");
  });

  it("formats date and time with fallback", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatTime(undefined)).toBe("-");
    const timestamp = new Date(2026, 4, 15, 10, 30).getTime();
    expect(formatDate(timestamp)).toBe("15.05");
    expect(formatTime(timestamp)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("keeps display constants complete", () => {
    expect(DISPLAY_CURRENCIES).toEqual(["BYN", "USD", "EUR", "RUB"]);
    expect(CURRENCY_SYMBOLS.BYN).toBe("BYN");
    expect(CURRENCY_SYMBOLS.USD).toBe("$");
    expect(CURRENCY_SYMBOLS.EUR).toBe("€");
    expect(CURRENCY_SYMBOLS.RUB).toBe("RUB");
  });

  it("parseBynPrice returns null for non-string input", () => {
    expect(parseBynPrice(null)).toBeNull();
    expect(parseBynPrice(123)).toBeNull();
  });

  it("formatDisplayPrice returns null for invalid input", () => {
    expect(formatDisplayPrice(NaN, "USD")).toBeNull();
    expect(formatDisplayPrice(100, "GBP")).toBeNull();
  });

  it("formatRate returns dash for non-finite rate", () => {
    expect(formatRate(NaN)).toBe("-");
    expect(formatRate(Infinity)).toBe("-");
  });

  it("formatRateLabel returns empty for non-target currency", () => {
    expect(formatRateLabel("GBP", 1)).toBe("");
  });
});
