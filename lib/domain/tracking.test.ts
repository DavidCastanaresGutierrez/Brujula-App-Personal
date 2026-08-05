import { describe, expect, it } from "vitest";
import {
  calendarWeekForDate,
  calculateDailyScore,
  calculateWeeklyGoalBonus,
  daysForMonthWeek,
  goalPeriodDetails,
  toggleCompletionForDay,
  weeklyGoalIncludesDate,
  weekdaysInMonth,
} from "./tracking";

describe("calendar rules", () => {
  it("uses one Monday-to-Sunday week across a month boundary", () => {
    expect(calendarWeekForDate(new Date(2026, 7, 1, 12))).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });

  it("uses one Monday-to-Sunday week across a year boundary", () => {
    expect(calendarWeekForDate(new Date(2027, 0, 1, 12))).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });

  it("keeps calendar dates stable around daylight-saving changes", () => {
    expect(calendarWeekForDate(new Date(2026, 2, 29, 12))).toEqual({
      start: "2026-03-23",
      end: "2026-03-29",
    });
    expect(calendarWeekForDate(new Date(2026, 9, 25, 12))).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
  });

  it("builds a Monday-to-Sunday goal period across month boundaries", () => {
    expect(goalPeriodDetails("weekly", new Date(2026, 7, 1, 12))).toEqual({
      key: "2026-07-27",
      due: "2026-08-02",
    });
  });

  it("keeps the existing 1-7, 8-14 monthly tracking groups", () => {
    expect(daysForMonthWeek(2026, 7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(daysForMonthWeek(2026, 7, 5)).toEqual([29, 30, 31]);
  });

  it("counts only working days through the requested date", () => {
    expect(weekdaysInMonth(2026, 7, 9)).toBe(5);
  });
});

describe("weeklyGoalIncludesDate", () => {
  it("keeps legacy Sunday-to-Saturday goals visible during their saved interval", () => {
    expect(weeklyGoalIncludesDate("2026-08-02", "2026-08-08", "2026-08-04")).toBe(true);
  });

  it("does not treat a future or finished weekly goal as current", () => {
    expect(weeklyGoalIncludesDate("2026-08-02", "2026-08-08", "2026-08-01")).toBe(false);
    expect(weeklyGoalIncludesDate("2026-08-02", "2026-08-08", "2026-08-09")).toBe(false);
  });
});

describe("completion rules", () => {
  it("allows at most one completion for the same day", () => {
    expect(toggleCompletionForDay([], 4)).toEqual([4]);
    expect(toggleCompletionForDay([4], 4)).toEqual([]);
  });

  it("allows exceeding a weekly goal on different days", () => {
    const first = toggleCompletionForDay([], 3);
    const second = toggleCompletionForDay(first, 4);
    expect(second).toEqual([3, 4]);
    expect(second).toHaveLength(2);
  });
});

describe("score rules", () => {
  const date = new Date(2026, 7, 4, 12);

  it("adds a limited daily bonus for an eligible weekly completion", () => {
    const result = calculateDailyScore(
      date,
      [
        { goal: 31, history: { "2026-08": [4] } },
        { goal: 31, history: { "2026-08": [] } },
      ],
      [{ goal: 1, history: { "2026-08": [4] } }],
    );
    expect(result.baseScore).toBe(5);
    expect(result.bonus).toBe(1);
    expect(result.finalScore).toBe(6);
  });

  it("records extra weekly completions without granting another bonus", () => {
    const result = calculateDailyScore(
      date,
      [{ goal: 31, history: { "2026-08": [] } }],
      [{ goal: 1, history: { "2026-08": [3, 4] } }],
    );
    expect(result.eligibleWeeklyDoneToday).toBe(0);
    expect(result.bonus).toBe(0);
  });

  it("awards 10% of the missing weekly score only when every goal is complete", () => {
    expect(calculateWeeklyGoalBonus(8, [{ status: "completed", currentValue: 1, targetValue: 1 }])).toEqual({
      earned: true,
      bonus: 0.2,
      finalScore: 8.2,
    });
    expect(calculateWeeklyGoalBonus(8, [{ status: "active", currentValue: 0, targetValue: 1 }]).bonus).toBe(0);
    expect(calculateWeeklyGoalBonus(8, []).earned).toBe(false);
  });
});
