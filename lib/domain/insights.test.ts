import { describe, expect, it } from "vitest";
import { generateActionableInsights } from "./insights";

const dates = (start: string, count: number) => Array.from({ length: count }, (_, index) => { const date = new Date(`${start}T12:00:00`); date.setDate(date.getDate() + index); return date.toISOString().slice(0, 10); });
const history = (items: string[]) => items.reduce<Record<string, number[]>>((result, key) => { (result[key.slice(0, 7)] ??= []).push(Number(key.slice(8))); return result; }, {});

describe("actionable insights", () => {
  it("detects a category decline between comparable windows", () => { const completed = [...dates("2026-07-15", 14), ...dates("2026-07-29", 4)]; const result = generateActionableInsights(new Date("2026-08-11T12:00:00"), [{ id: 1, name: "Entrenar", goal: 20, category: "health", history: history(completed) }], [{ id: "health", label: "Salud" }], []); expect(result.some((item) => item.id === "trend-health" && item.detail.includes("puntos"))).toBe(true); });
  it("excludes omitted and non-scheduled days from evidence", () => { const result = generateActionableInsights(new Date("2026-08-11T12:00:00"), [{ id: 1, name: "Entrenar", goal: 8, category: "health", schedule: { mode: "selectedWeekdays", weekdays: [1] }, skips: history(dates("2026-07-01", 42)) }], [{ id: "health", label: "Salud" }], []); expect(result).toHaveLength(1); expect(result[0].severity).toBe("positive"); });
  it("flags overdue goal steps before generic goal risk", () => { const result = generateActionableInsights(new Date("2026-08-11T12:00:00"), [], [], [{ id: 3, title: "Reforma", dueDate: "2026-08-20", status: "active", currentValue: 0, targetValue: 10, steps: [{ title: "Presupuesto", dueDate: "2026-08-10", completed: false }] }]); expect(result[0]).toMatchObject({ id: "goal-step-3", kind: "goal" }); });
  it("does not label a goal as stalled without temporal evidence", () => { const result = generateActionableInsights(new Date("2026-08-11T12:00:00"), [], [], [{ id: 4, title: "Ahorro", dueDate: "2026-12-31", status: "active", currentValue: 0, targetValue: 4_000 }]); expect(result.some((item) => item.title.includes("estanc"))).toBe(false); });
  it("only flags weekly goals during their final two days", () => {
    const goal = { id: 5, title: "Conversación profunda", period: "weekly" as const, dueDate: "2026-08-16", status: "active" as const, currentValue: 0, targetValue: 1 };
    const early = generateActionableInsights(new Date("2026-08-12T12:00:00"), [], [], [goal]);
    const nearDeadline = generateActionableInsights(new Date("2026-08-14T12:00:00"), [], [], [goal]);
    expect(early.some((item) => item.id === "goal-risk-5")).toBe(false);
    expect(nearDeadline.find((item) => item.id === "goal-risk-5")?.rule).toContain("2 días o menos");
  });
});
