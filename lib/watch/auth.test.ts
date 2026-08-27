import { describe, expect, it } from "vitest";
import { createPairingCode, createWatchToken, hashWatchSecret, WATCH_TOKEN_BYTES } from "./auth";

describe("watch authentication primitives", () => {
  it("creates six-digit pairing codes", () => {
    for (let index = 0; index < 100; index += 1) expect(createPairingCode()).toMatch(/^\d{6}$/);
  });

  it("creates high-entropy device tokens and stores only hashes", () => {
    const first = createWatchToken();
    const second = createWatchToken();
    expect(first).not.toBe(second);
    expect(Buffer.from(first, "base64url")).toHaveLength(WATCH_TOKEN_BYTES);
    expect(hashWatchSecret(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashWatchSecret(first)).not.toBe(hashWatchSecret(second));
  });
});
