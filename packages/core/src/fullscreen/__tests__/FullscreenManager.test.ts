import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FullscreenManager } from "../FullscreenManager.js";

/** テストごとに document.fullscreenElement を差し込む（Q1、jsdom は未実装のため defineProperty が必要）。 */
function setFullscreenElement(element: Element | null): void {
  Object.defineProperty(document, "fullscreenElement", {
    value: element,
    configurable: true,
  });
}

/** container を「ネイティブ Fullscreen API 対応環境」として扱うためのスタブを付与する（Q1）。 */
function stubNativeSupport(
  container: HTMLElement,
  options: { requestResult?: "resolve" | "reject"; exitResult?: "resolve" | "reject" } = {},
): void {
  const { requestResult = "resolve", exitResult = "resolve" } = options;
  container.requestFullscreen = vi.fn(() => {
    if (requestResult === "reject") return Promise.reject(new Error("denied"));
    setFullscreenElement(container);
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  }) as HTMLElement["requestFullscreen"];
  document.exitFullscreen = vi.fn(() => {
    if (exitResult === "reject") return Promise.reject(new Error("denied"));
    setFullscreenElement(null);
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
}

afterEach(() => {
  setFullscreenElement(null);
  vi.restoreAllMocks();
});

describe("FullscreenManager — non-native environment (BR-F-02, jsdom has no requestFullscreen by default)", () => {
  it("falls back to pseudo-fullscreen: applies fixed positioning and notifies onChange(true)", async () => {
    const container = document.createElement("div");
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    await manager.enter();

    expect(manager.isActive()).toBe(true);
    expect(container.style.position).toBe("fixed");
    expect(container.style.top).toBe("0px");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("restores the original inline style on exit and notifies onChange(false)", async () => {
    const container = document.createElement("div");
    container.style.color = "red";
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    await manager.enter();
    onChange.mockClear();
    await manager.exit();

    expect(manager.isActive()).toBe(false);
    expect(container.style.position).toBe("");
    expect(container.style.color).toBe("red");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("exits on Escape keydown while pseudo-fullscreen is active (BR-F-06)", async () => {
    const container = document.createElement("div");
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    await manager.enter();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(manager.isActive()).toBe(false);
    expect(container.style.position).toBe("");
  });

  it("ignores non-Escape keys while pseudo-fullscreen is active", async () => {
    const container = document.createElement("div");
    const manager = new FullscreenManager(container, vi.fn());

    await manager.enter();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(manager.isActive()).toBe(true);
  });

  it("dispose() while pseudo-fullscreen restores the style and stops listening for Escape", async () => {
    const container = document.createElement("div");
    const manager = new FullscreenManager(container, vi.fn());

    await manager.enter();
    manager.dispose();

    expect(container.style.position).toBe("");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(manager.isActive()).toBe(false); // 例外を投げず安全に無視される
  });
});

describe("FullscreenManager — native environment (BR-F-01/03/04/05, stubbed requestFullscreen)", () => {
  it("enters native fullscreen and reflects the state via the document fullscreenchange event", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    await manager.enter();

    expect(manager.isActive()).toBe(true);
    expect(container.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    // ネイティブモードではスタイルを変更しない（擬似モードとの違い）。
    expect(container.style.position).toBe("");
  });

  it("enter() is idempotent: calling it again while already active does not re-invoke requestFullscreen (BR-F-01)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const manager = new FullscreenManager(container, vi.fn());

    await manager.enter();
    await manager.enter();

    expect(container.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("exit() resolves and reflects the state when already inactive without calling exitFullscreen (idempotent)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const manager = new FullscreenManager(container, vi.fn());

    await manager.exit();

    expect(document.exitFullscreen).not.toHaveBeenCalled();
    expect(manager.isActive()).toBe(false);
  });

  it("exits native fullscreen via exitFullscreen()", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);
    await manager.enter();
    onChange.mockClear();

    await manager.exit();

    expect(manager.isActive()).toBe(false);
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("rejects enter() when requestFullscreen rejects, without changing state (BR-F-04)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container, { requestResult: "reject" });
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    await expect(manager.enter()).rejects.toThrow();

    expect(manager.isActive()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects exit() when exitFullscreen rejects, without changing state (BR-F-04)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container, { exitResult: "reject" });
    const manager = new FullscreenManager(container, vi.fn());
    await manager.enter();

    await expect(manager.exit()).rejects.toThrow();

    expect(manager.isActive()).toBe(true);
  });

  it("reflects an externally-initiated exit (e.g. Esc key handled natively by the browser, BR-F-05)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);
    await manager.enter();
    onChange.mockClear();

    // ブラウザが独自に処理した終了（FullscreenManager.exit() を経由しない）を模擬する。
    setFullscreenElement(null);
    document.dispatchEvent(new Event("fullscreenchange"));

    expect(manager.isActive()).toBe(false);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("ignores fullscreenchange events for a different element", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const onChange = vi.fn();
    const manager = new FullscreenManager(container, onChange);

    setFullscreenElement(document.createElement("span"));
    document.dispatchEvent(new Event("fullscreenchange"));

    expect(manager.isActive()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("dispose() while native fullscreen requests exit without waiting and stops listening (RP-F-1)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const manager = new FullscreenManager(container, vi.fn());
    await manager.enter();

    manager.dispose();

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    // dispose 後は fullscreenchange を購読していないため、状態は変化しない。
    setFullscreenElement(container);
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(manager.isActive()).toBe(false);
  });

  it("dispose() swallows a rejected exitFullscreen() without an unhandled rejection (RP-F-1)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container, { exitResult: "reject" });
    const manager = new FullscreenManager(container, vi.fn());
    await manager.enter();

    expect(() => manager.dispose()).not.toThrow();
    // マイクロタスクをフラッシュし、reject が確実に処理されることを確認する。
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe("FullscreenManager — PBT invariants (tech-stack-decisions.md §2)", () => {
  it("PBT: isActive() matches the expected reducer state after any sequence of enter()/exit() calls (native-capable)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("enter", "exit"), { maxLength: 15 }),
        async (ops) => {
          const container = document.createElement("div");
          stubNativeSupport(container);
          const manager = new FullscreenManager(container, vi.fn());

          for (const op of ops) {
            if (op === "enter") await manager.enter();
            else await manager.exit();
            // enter()/exit() は冪等（BR-F-01）なので、直前の呼び出し種別がそのまま結果状態になる。
            expect(manager.isActive()).toBe(op === "enter");
          }

          manager.dispose();
        },
      ),
    );
  });

  it("PBT: isActive() matches the expected reducer state after any sequence of enter()/exit() calls (pseudo-fallback)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("enter", "exit"), { maxLength: 15 }),
        async (ops) => {
          const container = document.createElement("div");
          const manager = new FullscreenManager(container, vi.fn());

          for (const op of ops) {
            if (op === "enter") await manager.enter();
            else await manager.exit();
            expect(manager.isActive()).toBe(op === "enter");
          }

          manager.dispose();
        },
      ),
    );
  });
});
