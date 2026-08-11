import { describe, expect, it } from "vitest";
import { clampProgress, fitnessChartModel, type FitnessEntry } from "./charts";

const entry = (id: number, recordedAt: string, weight: number): FitnessEntry => ({
  id, recordedAt, weight, muscle: 0, fatMass: 0, bodyWater: 0,
  bodyFat: 0, bmi: 0, basalMetabolicRate: 0,
});

describe("chart models", () => {
  it("limits ring progress to its visual range", () => {
    expect(clampProgress(-8)).toBe(0);
    expect(clampProgress(62)).toBe(62);
    expect(clampProgress(140)).toBe(100);
  });

  it("filters, sorts and summarizes fitness entries", () => {
    const model = fitnessChartModel([
      entry(2, "2026-08-10", 74),
      entry(1, "2026-07-01", 80),
      entry(3, "2026-08-05", 76),
    ], "weight", 30, new Date("2026-08-11T12:00:00"));

    expect(model.points.map(({ id }) => id)).toEqual([3, 2]);
    expect(model.values).toEqual([76, 74]);
    expect(model.change).toBe(-2);
    expect(model.span).toBe(2);
  });

  it("returns a stable empty model", () => {
    expect(fitnessChartModel([], "weight", 30, new Date("2026-08-11T12:00:00"))).toMatchObject({
      points: [], values: [], min: 0, span: 1, change: 0,
    });
  });
});
