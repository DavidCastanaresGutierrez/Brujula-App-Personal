import { describe, expect, it } from "vitest";
import { decideRemoteRevision, shouldRetryPendingSave } from "./sync";

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

describe("pending local saves", () => {
  it("retries a queued change after the active save finishes", () => {
    expect(shouldRetryPendingSave(true, true, false)).toBe(true);
  });

  it("does not create redundant saves when the queued state is already synchronized", () => {
    expect(shouldRetryPendingSave(true, false, false)).toBe(false);
    expect(shouldRetryPendingSave(false, true, false)).toBe(false);
  });

  it("does not retry over an unresolved multi-device conflict", () => {
    expect(shouldRetryPendingSave(true, true, true)).toBe(false);
  });
});
