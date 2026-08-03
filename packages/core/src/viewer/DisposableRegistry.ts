export type DisposeFn = () => void;

/**
 * dispose 対象を登録順（FIFO）に解体する（domain-entities.md E7 / logical-components.md L4 Registry）。
 * disposeAll() は冪等（BR-A-10）: 2 回目以降は no-op。
 */
export class DisposableRegistry {
  private readonly disposers: DisposeFn[] = [];
  private disposed = false;

  register(dispose: DisposeFn): void {
    this.disposers.push(dispose);
  }

  disposeAll(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
