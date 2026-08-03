export type ContextRecoveryStateValue = "healthy" | "lost" | "recovering" | "degraded";

/**
 * WebGL コンテキストロスト復帰の状態機械（nfr-design-patterns.md RP-2 / logical-components.md L5）。
 * 遷移表にない呼び出しは no-op（false を返す）。副作用（描画ループの停止/再開等）は呼び出し側が
 * 戻り値（実際に遷移したか）を見て判断する。
 */
export class ContextRecoveryState {
  private current: ContextRecoveryStateValue = "healthy";

  get value(): ContextRecoveryStateValue {
    return this.current;
  }

  /** healthy -> lost（webglcontextlost 検出）。BR-A-12。 */
  notifyContextLost(): boolean {
    if (this.current !== "healthy") return false;
    this.current = "lost";
    return true;
  }

  /** lost -> recovering（webglcontextrestored 検出）。 */
  notifyContextRestored(): boolean {
    if (this.current !== "lost") return false;
    this.current = "recovering";
    return true;
  }

  /** recovering -> healthy（リソース再構築成功）。 */
  notifyRebuildSucceeded(): boolean {
    if (this.current !== "recovering") return false;
    this.current = "healthy";
    return true;
  }

  /** recovering -> degraded（リソース再構築失敗。再試行しない、BR-A-12）。 */
  notifyRebuildFailed(): boolean {
    if (this.current !== "recovering") return false;
    this.current = "degraded";
    return true;
  }
}
