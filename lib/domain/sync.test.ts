import { describe, expect, it } from "vitest";
import { decideRemoteRevision } from "./sync";

describe("decideRemoteRevision", () => {
  it("applies a newer remote revision when the device is clean", () => {
    expect(decideRemoteRevision(4, 5, false)).toBe("apply");
  });

  it("raises a conflict when both devices changed", () => {
    expect(decideRemoteRevision(4, 5, true)).toBe("conflict");
  });

  it("ignores stale, duplicate and invalid revision notifications", () => {
    expect(decideRemoteRevision(5, 5, false)).toBe("ignore");
    expect(decideRemoteRevision(5, 4, false)).toBe("ignore");
    expect(decideRemoteRevision(5, Number.NaN, false)).toBe("ignore");
  });
});
