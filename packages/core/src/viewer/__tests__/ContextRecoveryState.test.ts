import { describe, expect, it } from "vitest";

import { ContextRecoveryState } from "../ContextRecoveryState.js";

describe("ContextRecoveryState", () => {
  it("starts in the healthy state", () => {
    const state = new ContextRecoveryState();
    expect(state.value).toBe("healthy");
  });

  it("healthy -> lost -> recovering -> healthy on successful recovery", () => {
    const state = new ContextRecoveryState();

    expect(state.notifyContextLost()).toBe(true);
    expect(state.value).toBe("lost");

    expect(state.notifyContextRestored()).toBe(true);
    expect(state.value).toBe("recovering");

    expect(state.notifyRebuildSucceeded()).toBe(true);
    expect(state.value).toBe("healthy");
  });

  it("healthy -> lost -> recovering -> degraded on failed recovery (no retry)", () => {
    const state = new ContextRecoveryState();

    state.notifyContextLost();
    state.notifyContextRestored();

    expect(state.notifyRebuildFailed()).toBe(true);
    expect(state.value).toBe("degraded");

    // BR-A-12: 再試行しない。restored が再度来ても遷移しない。
    expect(state.notifyContextRestored()).toBe(false);
    expect(state.value).toBe("degraded");
  });

  it("stays lost when webglcontextrestored never fires", () => {
    const state = new ContextRecoveryState();
    state.notifyContextLost();

    expect(state.value).toBe("lost");
    // 何も追加で通知されなくても lost のまま。
    expect(state.value).toBe("lost");
  });

  it("ignores notifyContextLost() when not healthy", () => {
    const state = new ContextRecoveryState();
    state.notifyContextLost();

    expect(state.notifyContextLost()).toBe(false);
    expect(state.value).toBe("lost");
  });

  it("ignores notifyContextRestored() when not lost", () => {
    const state = new ContextRecoveryState();
    expect(state.notifyContextRestored()).toBe(false);
    expect(state.value).toBe("healthy");
  });

  it("ignores notifyRebuildSucceeded()/notifyRebuildFailed() when not recovering", () => {
    const state = new ContextRecoveryState();

    expect(state.notifyRebuildSucceeded()).toBe(false);
    expect(state.value).toBe("healthy");

    expect(state.notifyRebuildFailed()).toBe(false);
    expect(state.value).toBe("healthy");
  });

  it("supports repeated healthy <-> lost <-> recovering cycles", () => {
    const state = new ContextRecoveryState();

    for (let i = 0; i < 3; i++) {
      expect(state.notifyContextLost()).toBe(true);
      expect(state.notifyContextRestored()).toBe(true);
      expect(state.notifyRebuildSucceeded()).toBe(true);
      expect(state.value).toBe("healthy");
    }
  });
});
