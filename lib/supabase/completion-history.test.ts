import { describe, expect, it } from "vitest";
import {
  isMissingCompletionHistoryRpc,
  mapAggregatedCompletionRows,
  mapCompletionRows,
} from "./completion-history";

describe("completion history", () => {
  it("groups legacy rows and sorts each period", () => {
    const result = mapCompletionRows([
      { habit_id: 7, period_key: "2026-08", value: 20 },
      { habit_id: 7, period_key: "2026-08", value: 2 },
      { habit_id: 8, period_key: "2026-07", value: 31 },
    ]);

    expect(result.get(7)).toEqual({ "2026-08": [2, 20] });
    expect(result.get(8)).toEqual({ "2026-07": [31] });
  });

  it("maps the aggregated RPC response without losing history", () => {
    const history = { "2026-07": [1, 8], "2026-08": [4, 12, 28] };
    const result = mapAggregatedCompletionRows([{ habit_id: 7, history }]);

    expect(result.get(7)).toEqual(history);
  });

  it("only falls back when the RPC is unavailable", () => {
    expect(isMissingCompletionHistoryRpc({ code: "42883" })).toBe(true);
    expect(isMissingCompletionHistoryRpc({ code: "PGRST202" })).toBe(true);
    expect(isMissingCompletionHistoryRpc({ code: "42501" })).toBe(false);
    expect(isMissingCompletionHistoryRpc(null)).toBe(false);
  });
});
