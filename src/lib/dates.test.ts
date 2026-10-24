import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  isDateOnly,
  monthGrid,
  relativeDayLabel,
  todayIn,
  urgencyOf,
} from "./dates";

describe("todayIn", () => {
  it("uses the user's timezone, not UTC", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India (UTC+5:30)
    const instant = new Date("2026-12-31T20:00:00Z");
    expect(todayIn("Asia/Kolkata", instant)).toBe("2027-01-01");
    expect(todayIn("America/New_York", instant)).toBe("2026-12-31");
    expect(todayIn("UTC", instant)).toBe("2026-12-31");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("diffs whole days, unaffected by DST", () => {
    expect(diffDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(diffDays("2026-11-05", "2026-11-01")).toBe(-4);
  });

  it("handles months", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("validates date-only strings", () => {
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2028-02-29")).toBe(true);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("26-1-1")).toBe(false);
  });

  it("builds a Monday-first month grid of whole weeks", () => {
    const grid = monthGrid("2026-10-15");
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe("2026-09-28");
    expect(grid).toContain("2026-10-31");
  });
});

describe("urgency", () => {
  const today = "2026-10-24";
  it("classifies dates", () => {
    expect(urgencyOf("2026-10-23", today)).toBe("overdue");
    expect(urgencyOf(today, today)).toBe("today");
    expect(urgencyOf("2026-10-27", today)).toBe("soon");
    expect(urgencyOf("2026-11-10", today)).toBe("later");
    expect(urgencyOf(null, today)).toBe("later");
  });
  it("labels relative days", () => {
    expect(relativeDayLabel("2026-10-25", today)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-21", today)).toBe("3 days overdue");
    expect(relativeDayLabel("2026-10-27", today)).toBe("In 3 days");
  });
});
