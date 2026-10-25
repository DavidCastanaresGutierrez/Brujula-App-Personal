import { describe, expect, it } from "vitest";
import { isLaunchView, parseLaunchIntent } from "./launch-intent";

describe("launch intent", () => {
  it("reads a known view and action", () => {
    expect(parseLaunchIntent("?view=nutrition&action=photo")).toEqual({ view: "nutrition", action: "photo" });
    expect(parseLaunchIntent("?view=today")).toEqual({ view: "today", action: null });
  });
  it("ignores unknown values and empty searches", () => {
    expect(parseLaunchIntent("?view=admin&action=delete")).toEqual({ view: null, action: null });
    expect(parseLaunchIntent("")).toEqual({ view: null, action: null });
    expect(isLaunchView("goals")).toBe(true);
    expect(isLaunchView("__proto__")).toBe(false);
  });
});
