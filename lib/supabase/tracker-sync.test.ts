import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteTrackerState, saveRemoteTrackerState, TrackerSyncError } from "./tracker-sync";

const state = { daily: [], weekly: [] };

afterEach(() => vi.unstubAllGlobals());

describe("tracker sync transport", () => {
  it("loads the remote state without browser caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state, revision: 3 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRemoteTrackerState("token")).resolves.toEqual({ state, revision: 3 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/state\?ts=\d+$/), expect.objectContaining({ cache: "no-store" }));
  });

  it("sends the baseline, snapshot and expected revision", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 4 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveRemoteTrackerState("token", null, state, 3)).resolves.toEqual({ revision: 4 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ base: null, state, expectedRevision: 3 });
  });

  it("marks revision conflicts explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "STATE_CONFLICT", error: "Conflicto" }), { status: 409 })));

    const error = await saveRemoteTrackerState("token", null, state, 1).catch((caught) => caught);
    expect(error).toBeInstanceOf(TrackerSyncError);
    expect(error.conflict).toBe(true);
  });

  it("keeps ordinary API failures separate from conflicts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Fallo" }), { status: 500 })));

    const error = await saveRemoteTrackerState("token", null, state, 1).catch((caught) => caught);
    expect(error).toMatchObject({ message: "Fallo", conflict: false });
  });
});
