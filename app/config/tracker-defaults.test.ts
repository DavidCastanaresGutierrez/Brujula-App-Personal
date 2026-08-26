import { describe, expect, it } from "vitest";
import { dailyMotivations, motivationForToday, upgradeDefaultMotivations } from "./tracker-defaults";

describe("daily motivations", () => {
  it("provides a unique rotation for an entire quarter", () => {
    expect(dailyMotivations).toHaveLength(93);
    expect(new Set(dailyMotivations).size).toBe(93);

    const start = new Date(2026, 0, 1);
    const rotation = Array.from({ length: dailyMotivations.length }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      return motivationForToday(dailyMotivations, date);
    });

    expect(new Set(rotation).size).toBe(dailyMotivations.length);
  });

  it("upgrades only the untouched legacy catalog", () => {
    const legacyCatalog = dailyMotivations.slice(0, 31);
    expect(upgradeDefaultMotivations(legacyCatalog)).toEqual(dailyMotivations);

    const customized = [...legacyCatalog, "Mi frase personal"];
    expect(upgradeDefaultMotivations(customized)).toEqual(customized);
    expect(upgradeDefaultMotivations(["Solo mi frase"])).toEqual(["Solo mi frase"]);
  });
});
