import { describe, expect, it } from "vitest";
import {
  calendarWeekForDate,
  calculateWeightedHabitDays,
  calculateDailyScore,
  calculateProportionalGoalBonus,
  calculateWeeklyGoalBonus,
  availableDaysForMonthWeek,
  daysForMonthWeek,
  goalPeriodDetails,
  ensureArchiveDate,
  habitAppliesOnDate,
  habitScheduledOnDate,
  isHabitVisibleInArchive,
  localDateKey,
  linkedGoalProgress,
  isCalendarDayInFuture,
  monthCalendarDateWeeks,
  monthCalendarWeeks,
  monthlyHabitProgressThrough,
  longestHabitStreak,
  toggleCompletionForDay,
  weeklyGoalIncludesDate,
  weekdaysInMonth,
  scheduledDaysInMonth,
} from "./tracking";

describe("calendar rules", () => {
  it("formats the device-local calendar day without converting it to UTC", () => {
    expect(localDateKey(new Date(2026, 7, 12, 0, 30))).toBe("2026-08-12");
    expect(localDateKey(new Date(2027, 0, 1, 0, 5))).toBe("2027-01-01");
  });

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

  it("splits a month into Monday-to-Sunday weeks, clipped at its boundaries", () => {
    expect(monthCalendarWeeks(2026, 7)).toEqual([
      [1, 2],
      [3, 4, 5, 6, 7, 8, 9],
      [10, 11, 12, 13, 14, 15, 16],
      [17, 18, 19, 20, 21, 22, 23],
      [24, 25, 26, 27, 28, 29, 30],
      [31],
    ]);
  });

  it("builds complete Monday-to-Sunday weeks shared by adjacent months", () => {
    const augustLastWeek = monthCalendarDateWeeks(2026, 7).at(-1);
    const septemberFirstWeek = monthCalendarDateWeeks(2026, 8)[0];
    expect(augustLastWeek).toEqual([
      "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
      "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
    expect(septemberFirstWeek).toEqual(augustLastWeek);
  });

  it("starts the first partial week on day one and ends it on Sunday", () => {
    expect(daysForMonthWeek(2026, 3, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(daysForMonthWeek(2026, 3, 2)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it("counts only working days through the requested date", () => {
    expect(weekdaysInMonth(2026, 7, 9)).toBe(5);
  });

  it("distinguishes past, current and future calendar days", () => {
    const today = new Date(2026, 7, 5, 12);
    expect(isCalendarDayInFuture(2026, 7, 4, today)).toBe(false);
    expect(isCalendarDayInFuture(2026, 7, 5, today)).toBe(false);
    expect(isCalendarDayInFuture(2026, 7, 6, today)).toBe(true);
    expect(isCalendarDayInFuture(2026, 8, 1, today)).toBe(true);
  });

  it("offers weekly completions only through today", () => {
    const today = new Date(2026, 7, 5, 12);
    expect(availableDaysForMonthWeek(2026, 7, 1, today)).toEqual([1, 2]);
    expect(availableDaysForMonthWeek(2026, 7, 2, today)).toEqual([3, 4, 5]);
    expect(availableDaysForMonthWeek(2026, 7, 3, today)).toEqual([]);
    expect(availableDaysForMonthWeek(2026, 6, 5, today)).toEqual([27, 28, 29, 30, 31]);
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
  it("shows a perfect current-month habit as 100% without counting future days", () => {
    const completedDays = Array.from({ length: 21 }, (_, index) => index + 1);
    expect(monthlyHabitProgressThrough({
      goal: 31,
      everyDay: true,
      history: { "2026-08": completedDays },
    }, 2026, 7, 21)).toEqual({ completed: 21, eligible: 21, percent: 100 });
  });

  it("removes skipped days from current-month progress", () => {
    expect(monthlyHabitProgressThrough({
      goal: 31,
      everyDay: true,
      history: { "2026-08": [1, 2, 3] },
      skips: { "2026-08": [4] },
    }, 2026, 7, 4)).toEqual({ completed: 3, eligible: 3, percent: 100 });
  });

  it("ignores future and unscheduled completion records", () => {
    expect(monthlyHabitProgressThrough({
      goal: 13,
      schedule: { mode: "selectedWeekdays", weekdays: [1, 3, 5] },
      history: { "2026-08": [3, 4, 5, 24] },
    }, 2026, 7, 5)).toEqual({ completed: 2, eligible: 2, percent: 100 });
  });

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

  it("finds the longest historical daily streak", () => {
    expect(longestHabitStreak({
      goal: 31,
      everyDay: true,
      history: { "2026-08": [1, 2, 4, 5, 6, 7] },
    })).toBe(4);
  });

  it("does not break scheduled streaks on weekends or skipped days", () => {
    expect(longestHabitStreak({
      goal: 23,
      weekdaysOnly: true,
      history: { "2026-08": [3, 4, 6, 7, 10] },
      skips: { "2026-08": [5] },
    })).toBe(5);
  });
});

describe("flexible habit schedules", () => {
  it("schedules only the selected weekdays", () => {
    const habit = { goal: 1, schedule: { mode: "selectedWeekdays" as const, weekdays: [1, 3, 5] } };
    expect(habitScheduledOnDate(habit, "2026-08-10")).toBe(true);
    expect(habitScheduledOnDate(habit, "2026-08-11")).toBe(false);
    expect(scheduledDaysInMonth(habit, 2026, 7)).toBe(13);
  });

  it("repeats every X days from a stable start date", () => {
    const habit = { goal: 1, schedule: { mode: "interval" as const, intervalDays: 3, startDate: "2026-08-01" } };
    expect(habitScheduledOnDate(habit, "2026-08-01")).toBe(true);
    expect(habitScheduledOnDate(habit, "2026-08-03")).toBe(false);
    expect(habitScheduledOnDate(habit, "2026-08-04")).toBe(true);
  });

  it("excludes dates outside the active period and inside a pause", () => {
    const habit = { goal: 1, schedule: { mode: "selectedWeekdays" as const, weekdays: [1, 2, 3, 4, 5, 6, 0], activeFrom: "2026-08-03", activeUntil: "2026-08-20", pausedFrom: "2026-08-10", pausedUntil: "2026-08-12" } };
    expect(habitScheduledOnDate(habit, "2026-08-02")).toBe(false);
    expect(habitScheduledOnDate(habit, "2026-08-05")).toBe(true);
    expect(habitScheduledOnDate(habit, "2026-08-11")).toBe(false);
    expect(habitScheduledOnDate(habit, "2026-08-21")).toBe(false);
  });

  it("removes unprogrammed habits from the daily score", () => {
    const result = calculateDailyScore(new Date(2026, 7, 11, 12), [
      { goal: 1, schedule: { mode: "selectedWeekdays", weekdays: [1] }, history: { "2026-08": [] } },
      { goal: 1, schedule: { mode: "selectedWeekdays", weekdays: [2] }, history: { "2026-08": [11] } },
    ], []);
    expect(result.scheduled).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.baseScore).toBe(10);
  });
});

describe("linked goal progress", () => {
  const habits = [
    { id: 1, goal: 31, history: { "2026-08": [3, 4] } },
    { id: 2, goal: 31, history: { "2026-08": [4, 5] } },
  ];

  it("counts every linked habit completion inside a weekly period", () => {
    expect(linkedGoalProgress({
      period: "weekly", periodKey: "2026-08-03", dueDate: "2026-08-09",
      currentValue: 0, linkedHabitIds: [1, 2],
    }, habits)).toBe(4);
  });

  it("keeps over-completion visible instead of truncating it at the target", () => {
    expect(linkedGoalProgress({
      period: "monthly", periodKey: "2026-08", dueDate: "2026-08-31",
      currentValue: 0, linkedHabitIds: [1],
    }, habits)).toBe(2);
  });

  it("weights several fitness habits equally per day", () => {
    expect(calculateWeightedHabitDays(habits, [1, 2], "2026-08-03", new Date(2026, 7, 5, 12))).toBe(2);
  });

  it("starts on January first when tracking began in a previous year", () => {
    const yearly = [{ id: 1, goal: 365, history: { "2026-01": [1, 2, 3] } }];
    expect(calculateWeightedHabitDays(yearly, [1], "2025-08-15", new Date(2026, 0, 3, 12))).toBe(3);
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

  it("gives each block equal influence regardless of its number of habits", () => {
    const result = calculateDailyScore(date, [
      { goal: 31, category: "health", history: { "2026-08": [4] } },
      { goal: 31, category: "health", history: { "2026-08": [4] } },
      { goal: 31, category: "health", history: { "2026-08": [] } },
      { goal: 31, category: "work", history: { "2026-08": [] } },
    ], [], [{ id: "health" }, { id: "work" }]);
    expect(result.baseScore).toBeCloseTo(10 / 3);
  });

  it("doubles the influence of priority blocks", () => {
    const result = calculateDailyScore(date, [
      { goal: 31, category: "health", history: { "2026-08": [4] } },
      { goal: 31, category: "work", history: { "2026-08": [] } },
    ], [], [{ id: "health" }, { id: "work", priority: true }]);
    expect(result.baseScore).toBeCloseTo(10 / 3);
  });

  it("excludes blocks without scheduled habits", () => {
    const result = calculateDailyScore(date, [
      { goal: 31, category: "health", history: { "2026-08": [4] } },
    ], [], [{ id: "health" }, { id: "empty", priority: true }]);
    expect(result.baseScore).toBe(10);
  });

  it("excludes skipped habits from the daily score denominator", () => {
    const result = calculateDailyScore(date, [
      { goal: 31, category: "health", history: { "2026-08": [4] } },
      { goal: 31, category: "health", history: { "2026-08": [] }, skips: { "2026-08": [4] } },
    ], [], [{ id: "health" }]);
    expect(result.completed).toBe(1);
    expect(result.scheduled).toBe(1);
    expect(result.baseScore).toBe(10);
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

  it("caps a weekly target to the days in a partial month week", () => {
    const result = calculateDailyScore(
      new Date(2026, 7, 1, 12),
      [{ goal: 31, history: { "2026-08": [] } }],
      [{ goal: 5, history: { "2026-08": [1] } }],
    );
    expect(result.eligibleWeeklyDoneToday).toBe(1);
    expect(result.bonus).toBe(1);
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

  it("scales monthly and yearly closing bonus with completed goals", () => {
    expect(calculateProportionalGoalBonus(8, [
      { status: "completed", currentValue: 1, targetValue: 1 },
      { status: "active", currentValue: 0, targetValue: 1 },
    ])).toEqual({ completed: 1, total: 2, completionRate: 0.5, bonus: 0.1, finalScore: 8.1 });
  });

  it("does not grant a proportional bonus without goals", () => {
    expect(calculateProportionalGoalBonus(7, [])).toEqual({ completed: 0, total: 0, completionRate: 0, bonus: 0, finalScore: 7 });
  });

  it("caps proportional closing scores at ten", () => {
    expect(calculateProportionalGoalBonus(10, [{ status: "completed", currentValue: 2, targetValue: 1 }]).finalScore).toBe(10);
  });
});

describe("archived habit rules", () => {
  const archived = { goal: 31, archived: true, archivedAt: "2026-08-05" };

  it("keeps archived habits in scores before their archive date only", () => {
    expect(habitAppliesOnDate(archived, "2026-08-04")).toBe(true);
    expect(habitAppliesOnDate(archived, "2026-08-05")).toBe(false);
  });

  it("hides dated archives after seven days but keeps legacy archives visible", () => {
    expect(isHabitVisibleInArchive(archived, new Date(2026, 7, 11, 12))).toBe(true);
    expect(isHabitVisibleInArchive(archived, new Date(2026, 7, 12, 12))).toBe(false);
    expect(isHabitVisibleInArchive({ goal: 31, archived: true }, new Date(2026, 7, 12, 12))).toBe(true);
  });

  it("starts the seven-day retention window for legacy archived habits", () => {
    const legacyArchive = { id: 7, goal: 31, archived: true };
    expect(ensureArchiveDate(legacyArchive, "2026-08-25")).toEqual({
      ...legacyArchive,
      archivedAt: "2026-08-25",
    });
  });

  it("does not alter active habits or overwrite an existing archive date", () => {
    const active = { goal: 31 };
    const datedArchive = { goal: 31, archived: true, archivedAt: "2026-08-05" };
    expect(ensureArchiveDate(active, "2026-08-25")).toBe(active);
    expect(ensureArchiveDate(datedArchive, "2026-08-25")).toBe(datedArchive);
  });
});
