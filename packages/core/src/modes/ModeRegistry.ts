import type { ViewerMode } from "../viewer/ViewerMode.js";

/**
 * `id` による `ViewerMode` の登録簿（domain-entities.md E1、BR-C-01）。
 * 同梱 7 モードもカスタムモードと同じこの機構の上に登録される（US-12）。
 */
export class ModeRegistry {
  private readonly modes = new Map<string, ViewerMode>();

  /** 同一 `id` が既に登録されている場合は上書きする。 */
  register(mode: ViewerMode): void {
    this.modes.set(mode.id, mode);
  }

  get(id: string): ViewerMode | undefined {
    return this.modes.get(id);
  }

  has(id: string): boolean {
    return this.modes.has(id);
  }

  /** 登録順の `id` 一覧（BR-C-13）。 */
  listIds(): string[] {
    return [...this.modes.keys()];
  }
}
