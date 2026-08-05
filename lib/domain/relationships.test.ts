import { describe, expect, it } from "vitest";
import { removeGoalAndChildReferences, removeHabitFromGoals, replaceCategory } from "./relationships";

describe("relationship integrity", () => {
  it("removes a deleted habit from every goal without dropping other links", () => {
    const goals = [
      { id: 1, category: "health", linkedHabitIds: [10, 11], linkedHabitId: 10 },
      { id: 2, category: "health", linkedHabitIds: [12] },
    ];

    expect(removeHabitFromGoals(goals, 10)).toEqual([
      { id: 1, category: "health", linkedHabitIds: [11], linkedHabitId: undefined },
      goals[1],
    ]);
  });

  it("deletes an annual goal and detaches its weekly and monthly children", () => {
    const goals = [
      { id: 1, category: "growth" },
      { id: 2, category: "growth", parentAnnualGoalId: 1 },
      { id: 3, category: "health", parentAnnualGoalId: 9 },
    ];

    expect(removeGoalAndChildReferences(goals, 1)).toEqual([
      { id: 2, category: "growth", parentAnnualGoalId: undefined },
      goals[2],
    ]);
  });

  it("moves habits and goals when their category is deleted", () => {
    const items = [{ id: 1, category: "old" }, { id: 2, category: "other" }];
    expect(replaceCategory(items, "old", "new")).toEqual([
      { id: 1, category: "new" },
      items[1],
    ]);
  });
});
