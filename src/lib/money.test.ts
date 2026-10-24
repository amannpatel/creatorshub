import { describe, expect, it } from "vitest";
import { addTo, formatMoney, minorToInputString, moneyEntries, parseAmountToMinor } from "./money";

describe("parseAmountToMinor", () => {
  it("parses whole and decimal amounts without float errors", () => {
    expect(parseAmountToMinor("25000")).toBe(2_500_000);
    expect(parseAmountToMinor("0.1")).toBe(10);
    expect(parseAmountToMinor("19.99")).toBe(1999);
    expect(parseAmountToMinor("1,20,000.50")).toBe(12_000_050);
    expect(parseAmountToMinor("₹ 2,000")).toBe(200_000);
    expect(parseAmountToMinor("Rs. 500")).toBe(50_000);
    expect(parseAmountToMinor(1500.5)).toBe(150_050);
  });

  it("rejects invalid input", () => {
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor("-5")).toBeNull();
    expect(parseAmountToMinor("1.234")).toBeNull();
    expect(parseAmountToMinor(null)).toBeNull();
  });
});

describe("formatting helpers", () => {
  it("round-trips input strings", () => {
    expect(minorToInputString(2_500_000)).toBe("25000");
    expect(minorToInputString(1999)).toBe("19.99");
    expect(minorToInputString(1005)).toBe("10.05");
    expect(minorToInputString(0)).toBe("");
  });

  it("formats INR with Indian grouping", () => {
    expect(formatMoney(12_000_000, "INR")).toBe("₹1,20,000");
    expect(formatMoney(150, "USD")).toBe("$1.50");
  });

  it("keeps currencies separate and orders the preferred one first", () => {
    const m = {};
    addTo(m, "USD", 100);
    addTo(m, "INR", 500);
    addTo(m, "INR", 250);
    expect(m).toEqual({ USD: 100, INR: 750 });
    expect(moneyEntries(m, "INR")[0]).toEqual(["INR", 750]);
  });
});
